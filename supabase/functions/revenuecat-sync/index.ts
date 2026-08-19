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

type Purchase = { product_id: string; status: string };
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
    purchases.push(...page.items);
    url = page.next_page;
  }

  // Only owned, non-refunded purchases grant anything.
  const productIds = [...new Set(purchases.filter((p) => p.status === "owned").map((p) => p.product_id))];

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const granted: string[] = [];
  const failed: string[] = [];
  for (const productId of productIds) {
    const { data, error } = await supabase.rpc("grant_purchase", {
      p_event_id: null,
      p_user: uid,
      p_product: productId,
      p_raw: { source: "sync", entries: purchases.filter((p) => p.product_id === productId) },
    });
    if (error) {
      console.error("revenuecat-sync: grant_purchase failed", productId, error);
      failed.push(productId);
      continue;
    }
    const result = data as { ok: boolean; granted?: string[] };
    if (result.ok && result.granted) granted.push(...result.granted);
  }

  if (productIds.length > 0 && failed.length === productIds.length) {
    return new Response("all grant attempts failed", { status: 500 });
  }

  return Response.json({ ok: true, granted, ...(failed.length > 0 ? { failed } : {}) });
});
