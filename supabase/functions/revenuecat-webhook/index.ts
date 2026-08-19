// RevenueCat webhook receiver — server-side truth for cosmetic purchases (Phase 3a).
// RevenueCat calls this on every entitlement event; it verifies the shared secret,
// then hands off to grant_purchase() (service role) to do the actual DB write. This
// function never asserts ownership itself — grant_purchase is the only writer.
//
// Deploy:   supabase functions deploy revenuecat-webhook
//           (verify_jwt=false is set in supabase/config.toml — RevenueCat isn't a
//           Supabase JWT holder, unlike every other function in this project.)
// Secrets:  REVENUECAT_WEBHOOK_SECRET (set via supabase secrets set), plus the
//           standard SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected automatically.
//
// Configure in the RevenueCat dashboard (Project settings -> Integrations -> Webhooks):
//   URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value: the same string as REVENUECAT_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RevenueCatEvent = {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    product_id: string;
    [key: string]: unknown;
  };
};

// Only these event types represent a new non-consumable grant for Phase 3a's
// cosmetics-only catalog. Everything else (RENEWAL, CANCELLATION, EXPIRATION,
// BILLING_ISSUE, ...) is subscription-only noise until Phase 3b exists.
const GRANT_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!secret || auth !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: RevenueCatEvent;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = body.event;
  if (!event?.id || !event.app_user_id || !event.product_id) {
    console.error("revenuecat-webhook: malformed event", body);
    return Response.json({ ok: true, skipped: "malformed" });
  }

  if (!GRANT_EVENT_TYPES.has(event.type)) {
    return Response.json({ ok: true, skipped: "not_a_grant_event" });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const { data, error } = await supabase.rpc("grant_purchase", {
    p_event_id: event.id,
    p_user: event.app_user_id,
    p_product: event.product_id,
    p_raw: body,
  });

  if (error) {
    console.error("revenuecat-webhook: grant_purchase failed", error);
    return new Response("grant failed", { status: 500 });
  }

  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    console.error("revenuecat-webhook: unknown product", event.product_id);
  }

  return Response.json({ ok: true, result });
});
