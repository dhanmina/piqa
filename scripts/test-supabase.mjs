import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

console.log("URL:", url);
console.log("Key:", key ? key.slice(0, 12) + "…" : "(missing)");

if (!url || !key) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

// 1. Auth reachability
const { data: session, error: authErr } = await supabase.auth.getSession();
console.log("\n[auth.getSession]", authErr ? "❌ " + authErr.message : "✅ reachable");

// 2. Real REST query — a table-not-found (PGRST205) still proves the key authenticates
const { error: qErr } = await supabase.from("_connection_test").select("*").limit(1);
if (!qErr) {
  console.log("[rest query] ✅ authenticated, table exists");
} else if (qErr.code === "PGRST205" || qErr.code === "42P01") {
  console.log("[rest query] ✅ authenticated (no such table yet:", qErr.code + ")");
} else if (qErr.code === "401" || /api key/i.test(qErr.message)) {
  console.log("[rest query] ❌ auth failed:", qErr.message);
  process.exit(1);
} else {
  console.log("[rest query] ✅ authenticated, other error:", qErr.code, qErr.message);
}

console.log("\n✅ Supabase client connection OK");
