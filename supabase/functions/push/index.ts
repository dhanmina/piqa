// Expo Push sender (spec §14) — the server half of the notification system.
//
// A single trusted endpoint that resolves recipient tokens and fans out to the
// Expo Push API. Callers pass a message plus WHO to send to; the function looks
// up push tokens itself (service role), so no token ever leaves the backend.
//
// Deploy:   supabase functions deploy push
// Secrets:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Call it (service role only) with one or more recipient selectors:
//   POST /functions/v1/push
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "title": "...", "body": "...", "data": { "type": "potd", "photoId": "..." },
//     "userIds": ["..."] | "region": "BETA" | "tokens": ["ExponentPushToken[...]"] }
//
// Wiring the triggers (next step, not here):
//   • drop-live / reveal → a scheduled invocation (cron) at drops_at / voting_closes_at,
//     with `region` + a 10–15 min jitter, so the whole region isn't pinged at once.
//   • PotD / made-gallery / follow → close_day / the follow insert calls this via
//     pg_net with `userIds`, so rewards land the moment they're earned.
//
// No sound, ever (spec §11b). The app works fully without push, so callers treat
// a failure here as best-effort.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request

type PushRequest = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Explicit Expo push tokens. */
  tokens?: string[];
  /** Resolve tokens from these users' profiles. */
  userIds?: string[];
  /** Resolve tokens for a whole region (drop-live / reveal fan-out). */
  region?: string;
};

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Trusted callers only — this can message every user, so gate on the service key.
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let input: PushRequest;
  try {
    input = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!input.title || !input.body) {
    return new Response("title and body are required", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  // Collect recipient tokens (dedup across selectors).
  const tokens = new Set<string>((input.tokens ?? []).filter(Boolean));
  const collect = (rows: { push_token: string | null }[] | null) =>
    rows?.forEach((r) => r.push_token && tokens.add(r.push_token));

  if (input.userIds?.length) {
    const { data } = await supabase
      .from("profiles")
      .select("push_token")
      .in("id", input.userIds)
      .not("push_token", "is", null);
    collect(data);
  }
  if (input.region) {
    const { data } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("region", input.region)
      .not("push_token", "is", null);
    collect(data);
  }

  const messages = [...tokens].map((to) => ({
    to,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    sound: null, // no sound, ever (spec §11b)
    channelId: "default",
  }));
  if (messages.length === 0) return Response.json({ sent: 0 });

  const tickets: unknown[] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + EXPO_CHUNK)),
    });
    tickets.push(await res.json());
  }

  return Response.json({ sent: messages.length, tickets });
});
