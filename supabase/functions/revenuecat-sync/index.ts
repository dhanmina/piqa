// RevenueCat purchase reconciliation — called by the client right after a purchase
// or a Restore Purchases tap, so unlocking never depends on webhook delivery timing
// (RevenueCat's webhook usually fires within seconds, but the app can't block a
// purchase flow on a delivery guarantee it doesn't have). Reads the calling user's
// own purchase history from RevenueCat's v2 REST API and grants anything missing
// via the same grant_purchase() RPC the webhook uses, so the two paths can never
// disagree on what "owned" means.
//
// Uses the v2 Customer Information API (GET .../customers/{id}/purchases), not v1 —
// a v2 secret API key (the kind RevenueCat's dashboard now issues by default) is
// rejected by v1 endpoints with a 403. v2's purchase.product_id is RevenueCat's own
// INTERNAL product id, not the store product identifier the webhook sends — that's
// why grant_purchase() matches on either frames.product_id or
// frames.revenuecat_product_id (see migration 20260819120000).
//
// Deploy:   supabase functions deploy revenuecat-sync
// Secrets:  REVENUECAT_SECRET_API_KEY, REVENUECAT_PROJECT_ID (set via
//           supabase secrets set), plus the standard SUPABASE_URL /
//           SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Call it (authenticated, normal user session):
//   POST /functions/v1/revenuecat-sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Purchase = { product_id: string; status: string; revenue_in_usd?: { gross: number } };
type PurchasesPage = { items: Purchase[]; next_page: string | null };

function subFromJwt(token: string): string | null {
  try {
    const seg = token.split(".")[1] ?? "";
    const payload = JSON.parse(atob(seg.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const uid = subFromJwt(token);
  if (!uid) return new Response("unauthorized", { status: 401 });

  const apiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
  const projectId = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "";
  if (!apiKey || !projectId) return new Response("revenuecat not configured", { status: 500 });

  const purchases: Purchase[] = [];
  let url: string | null =
    `https://api.revenuecat.com/v2/projects/${projectId}/customers/${uid}/purchases`;
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      console.error("revenuecat-sync: purchases fetch failed", res.status, await res.text());
      return new Response("revenuecat lookup failed", { status: 502 });
    }
    const page = (await res.json()) as PurchasesPage;
    purchases.push(...(page.items ?? []));
    // next_page is a relative path in RevenueCat's v2 API, not an absolute URL —
    // fetch() needs an absolute one. new URL(x, base) resolves a relative path
    // against base and passes an already-absolute one through unchanged, so this
    // is correct regardless of which shape a given response actually sends.
    url = page.next_page ? new URL(page.next_page, "https://api.revenuecat.com").toString() : null;
  }

  // Only owned, non-refunded purchases grant anything.
  const productIds = [...new Set(purchases.filter((p) => p.status === "owned").map((p) => p.product_id))];

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const granted: string[] = [];
  // RPC-error ids (transient/transport failures — worth a 500 if every attempt
  // fails, since retrying might help) tracked separately from unknown-product/user
  // ids (a data/config problem — retrying never helps, and the caller still needs
  // to know its purchase wasn't recognized rather than being told "ok" with nothing
  // granted).
  const failed: string[] = [];
  const unknown: string[] = [];
  for (const productId of productIds) {
    const entries = purchases.filter((p) => p.product_id === productId);
    // Sum every entry's gross for this product -- a product can appear more
    // than once in the purchase history (e.g. a consumable repurchased), and
    // every dollar should count toward lifetime VIP spend.
    const amountUsd = entries.reduce((sum, p) => sum + (p.revenue_in_usd?.gross ?? 0), 0);
    const { data, error } = await supabase.rpc("grant_purchase", {
      // A stable, deterministic id per user+product (not null) so repeat syncs of
      // an already-owned product (e.g. Restore Purchases tapped more than once, or
      // called again after a reinstall) hit grant_purchase()'s existing
      // revenuecat_event_id dedup check instead of generating a fresh random
      // 'sync:<uuid>' id every call -- otherwise the same purchase's amount_usd
      // gets re-summed into lifetime VIP spend on every sync.
      p_event_id: `sync:${uid}:${productId}`,
      p_user: uid,
      p_product: productId,
      p_raw: { source: "sync", entries },
      p_amount_usd: amountUsd,
    });
    if (error) {
      console.error("revenuecat-sync: grant_purchase failed", productId, error);
      failed.push(productId);
      continue;
    }
    const result = data as { ok: boolean; granted?: string[]; reason?: string };
    if (result.ok) {
      if (result.granted) granted.push(...result.granted);
    } else if (result.reason === "unknown_product" || result.reason === "unknown_user") {
      // unknown_user shouldn't be reachable via this path (uid comes from the
      // caller's own JWT, which should always resolve to a real profile), but
      // handled defensively the same way as unknown_product just in case.
      console.error("revenuecat-sync: unrecognized grant_purchase result", productId, result.reason);
      unknown.push(productId);
    }
  }

  if (productIds.length > 0 && failed.length === productIds.length) {
    return new Response("all grant attempts failed", { status: 500 });
  }

  return Response.json({
    ok: true,
    granted,
    ...(failed.length > 0 ? { failed } : {}),
    ...(unknown.length > 0 ? { unknown } : {}),
  });
});
