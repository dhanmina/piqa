// RevenueCat purchase reconciliation — called by the client right after a purchase
// or a Restore Purchases tap, so unlocking never depends on webhook delivery timing
// (RevenueCat's webhook usually fires within seconds, but the app can't block a
// purchase flow on a delivery guarantee it doesn't have). Reads the calling user's
// own subscriber record from RevenueCat's REST API and grants anything missing via
// the same grant_purchase() RPC the webhook uses, so the two paths can never
// disagree on what "owned" means.
//
// Deploy:   supabase functions deploy revenuecat-sync
// Secrets:  REVENUECAT_SECRET_API_KEY (set via supabase secrets set), plus the
//           standard SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Call it (authenticated, normal user session):
//   POST /functions/v1/revenuecat-sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type NonSubscriptionsMap = Record<string, { id: string; purchase_date: string }[]>;

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
  if (!apiKey) return new Response("revenuecat not configured", { status: 500 });

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${uid}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error("revenuecat-sync: subscriber fetch failed", res.status, await res.text());
    return new Response("revenuecat lookup failed", { status: 502 });
  }

  const body = await res.json();
  const nonSubs: NonSubscriptionsMap = body?.subscriber?.non_subscriptions ?? {};
  const productIds = Object.keys(nonSubs);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const granted: string[] = [];
  const failed: string[] = [];
  for (const productId of productIds) {
    const { data, error } = await supabase.rpc("grant_purchase", {
      p_event_id: null,
      p_user: uid,
      p_product: productId,
      p_raw: { source: "sync", entries: nonSubs[productId] },
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
