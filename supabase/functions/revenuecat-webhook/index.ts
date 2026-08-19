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

// grant_purchase()'s p_user is a uuid column. RevenueCat can send a non-UUID
// app_user_id (e.g. an unaliased anonymous id, "$RCAnonymousID:..."), which would
// fail at Postgres's argument-parsing layer before grant_purchase's own body ever
// runs — that surfaces as an RPC transport error, indistinguishable from a real DB
// outage, and would 500-retry forever for no reason. Caught here instead, before
// the RPC call, so it can be acked like every other permanently-unprocessable case.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!secret || auth !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: RevenueCatEvent;
  try {
    body = await req.json();
  } catch (e) {
    console.error("revenuecat-webhook: invalid json", e);
    return Response.json({ ok: true, skipped: "invalid_json" });
  }

  const event = body.event;
  if (!event?.id || !event.app_user_id || !event.product_id) {
    console.error("revenuecat-webhook: malformed event", body);
    return Response.json({ ok: true, skipped: "malformed" });
  }

  if (!GRANT_EVENT_TYPES.has(event.type)) {
    return Response.json({ ok: true, skipped: "not_a_grant_event" });
  }

  if (!UUID_RE.test(event.app_user_id)) {
    console.error("revenuecat-webhook: non-uuid app_user_id, cannot process", event.app_user_id);
    return Response.json({ ok: true, skipped: "invalid_app_user_id" });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  // RevenueCat's webhook payload carries price as event.price (a number, USD)
  // on INITIAL_PURCHASE/NON_RENEWING_PURCHASE events -- confirmed against
  // RevenueCat's webhook event schema docs. Falls back to null (counts as $0
  // toward VIP spend) if a future event type ever omits it, rather than
  // failing the whole grant over a missing price.
  const amountUsd = typeof event.price === "number" ? event.price : null;

  const { data, error } = await supabase.rpc("grant_purchase", {
    p_event_id: event.id,
    p_user: event.app_user_id,
    p_product: event.product_id,
    p_raw: body,
    p_amount_usd: amountUsd,
  });

  if (error) {
    // A real RPC/transport failure — the only case RevenueCat should retry.
    console.error("revenuecat-webhook: grant_purchase failed", error);
    return new Response("grant failed", { status: 500 });
  }

  const result = data as { ok: boolean; reason?: string };
  if (!result.ok && result.reason === "unknown_user") {
    // Valid UUID, but no matching account (e.g. deleted since purchase). Retrying
    // can't fix this — log it (it's a real signal something's off) and ack.
    console.error("revenuecat-webhook: unknown user", event.app_user_id);
  } else if (!result.ok) {
    console.error("revenuecat-webhook: unknown product", event.product_id);
  }

  return Response.json({ ok: true, result });
});
