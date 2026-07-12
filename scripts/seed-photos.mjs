/**
 * Populate REAL photos for the seed data so nothing renders blank.
 *
 * Nothing here is hardcoded into the app: this is a one-off dev script that
 * pulls real JPEGs from the internet and uploads them to Supabase Storage at
 * each submission's own path, signing in as that account so RLS is respected
 * (users may only write their own {drop_id}/{user_id}.jpg objects). It also
 * sets up a testable chocopndn account with a gallery entry + archive shots.
 *
 * Run (password is NOT stored in the repo — pass it at runtime):
 *   SEED_PASSWORD='...' node scripts/seed-photos.mjs
 *
 * Source: picsum.photos — free, keyless, real photographs (Unsplash-backed).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) {
  console.error("Set SEED_PASSWORD, e.g.  SEED_PASSWORD='...' node scripts/seed-photos.mjs");
  process.exit(1);
}
const CHOCO_EMAIL = 'chocopndn@gmail.com';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim())),
);

const newClient = () =>
  createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// Node's fetch (undici) drops connections intermittently on a long bulk run —
// a single transient "fetch failed" shouldn't abort the whole seed. Retry any
// step a few times with linear backoff before giving up.
async function withRetry(label, fn, attempts = 5) {
  let lastErr;
  for (let a = 1; a <= attempts; a++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (a < attempts) await new Promise((r) => setTimeout(r, 600 * a));
    }
  }
  throw new Error(`${label} failed after ${attempts} tries: ${lastErr?.message ?? lastErr}`);
}

async function jpeg(seed, w, h) {
  const res = await fetch(`https://picsum.photos/seed/${seed}/${w}/${h}.jpg`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${seed}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadPair(sb, seed, fullPath, thumbPath) {
  // 4:5 portrait — the canonical Piqa frame (matches the capture crop). Same
  // picsum seed for both sizes so the thumbnail is just a downscaled version of
  // the full-res (a different seed makes them two unrelated photos → the grid
  // thumb and the detail full-res would show different images).
  const [full, thumb] = await Promise.all([
    withRetry(`fetch ${seed} full`, () => jpeg(seed, 1080, 1350)),
    withRetry(`fetch ${seed} thumb`, () => jpeg(seed, 300, 375)),
  ]);
  for (const [path, bytes] of [[fullPath, full], [thumbPath, thumb]]) {
    await withRetry(`upload ${path}`, async () => {
      const { error } = await sb.storage
        .from('submissions')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
    });
  }
}

// --- Part A: real photos for the 30 seed submissions -----------------------
// Storage RLS only lets a user write objects whose filename is their own uid
// (the same {drop_id}/{uid}.jpg the capture pipeline uses). The seed built
// paths from raw md5 hex instead of the dashed uuid, so we upload to the
// correct path AND repair the row's image_path/thumb_path to match.
async function seedSubmissionPhotos() {
  let done = 0;
  for (let i = 1; i <= 30; i++) {
    const email = i <= 4 ? `house${i}@joinpiqa.com` : `seed${String(i).padStart(2, '0')}@joinpiqa.com`;
    const sb = newClient();
    const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
    if (authErr) {
      console.warn(`  skip ${email}: ${authErr.message}`);
      continue;
    }
    const uid = auth.user.id;
    // Only this account's OWN submissions: RLS lets it upload/repair just those
    // (writing another owner's path makes an orphan object nothing references,
    // and the row-update below no-ops under RLS). Filtering here is the same
    // correct result with a fraction of the work.
    const { data: subs } = await sb
      .from('submissions')
      .select('id, drop_id, image_path, thumb_path')
      .eq('user_id', uid);
    for (const s of subs ?? []) {
      const full = `${s.drop_id}/${uid}.jpg`;
      const thumb = `${s.drop_id}/${uid}_thumb.jpg`;
      await uploadPair(sb, `piqa-${email}-${s.drop_id.slice(0, 8)}`, full, thumb);
      if (s.image_path !== full || s.thumb_path !== thumb) {
        await sb.from('submissions').update({ image_path: full, thumb_path: thumb }).eq('id', s.id);
      }
      done++;
    }
    await sb.auth.signOut();
    process.stdout.write(`\r  uploaded photos for ${i}/30 accounts (${done} submissions)`);
  }
  console.log('');
}

// --- Part B: chocopndn test account ---------------------------------------
async function setupChocopndn() {
  const sb = newClient();
  // Sign in first — a repeat signUp on an existing email returns an obfuscated
  // no-session user. Only sign up if the account doesn't exist yet.
  let uid;
  const { data: signIn } = await sb.auth.signInWithPassword({ email: CHOCO_EMAIL, password: PASSWORD });
  uid = signIn?.user?.id;
  if (!uid) {
    const { data: signUp, error } = await sb.auth.signUp({
      email: CHOCO_EMAIL,
      password: PASSWORD,
      options: { data: { username: 'chocopndn' } },
    });
    if (error) throw error;
    if (!signUp.session) {
      const retry = await sb.auth.signInWithPassword({ email: CHOCO_EMAIL, password: PASSWORD });
      uid = retry.data?.user?.id;
    } else {
      uid = signUp.user?.id;
    }
  }
  const { data: who } = await sb.auth.getUser();
  if (!who.user || who.user.id !== uid) throw new Error('chocopndn session not established');

  // Latest BETA drop (today's) — give chocopndn a strong gallery entry there.
  const { data: drop } = await sb
    .from('prompt_drops')
    .select('id, drops_at')
    .eq('region', 'BETA')
    .order('drop_date', { ascending: false })
    .limit(1)
    .single();

  if (drop) {
    const full = `${drop.id}/${uid}.jpg`;
    const thumb = `${drop.id}/${uid}_thumb.jpg`;
    await uploadPair(sb, `piqa-chocopndn-shot`, full, thumb);
    const capturedAt = new Date(new Date(drop.drops_at).getTime() + 12 * 60000).toISOString();
    await sb.from('submissions').upsert(
      {
        drop_id: drop.id,
        user_id: uid,
        image_path: full,
        thumb_path: thumb,
        captured_at: capturedAt,
        vote_count: 40, // tops the seed field so chocopndn reads as the winner
        rating: 1180,
      },
      { onConflict: 'drop_id,user_id' },
    );
  }

  // Two archive (free) shots so Archive/Profile aren't empty either.
  // Idempotent: clear chocopndn's existing free shots first.
  await sb.from('free_shots').delete().eq('user_id', uid);
  for (let k = 1; k <= 2; k++) {
    const id = crypto.randomUUID();
    const full = `free/${uid}/${id}.jpg`;
    const thumb = `free/${uid}/${id}_thumb.jpg`;
    await uploadPair(sb, `piqa-chocopndn-free-${k}`, full, thumb);
    await sb.from('free_shots').insert({
      user_id: uid,
      image_path: full,
      thumb_path: thumb,
      captured_at: new Date(Date.now() - k * 3600_000).toISOString(),
    });
  }
  await sb.auth.signOut();
  console.log(`  chocopndn ready (${CHOCO_EMAIL}) — gallery entry + 2 archive shots`);
}

const chocoOnly = process.argv.includes('--choco-only');
if (!chocoOnly) {
  console.log('Uploading real photos for seed submissions…');
  await seedSubmissionPhotos();
}
console.log('Setting up chocopndn…');
await setupChocopndn();
console.log('Done.');
