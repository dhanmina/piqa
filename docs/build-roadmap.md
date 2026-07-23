# Piqa — Build Roadmap (new features)

*Draft · Jul 2026 · sequences the work in `feature-research.md` + `monetization-plan.md` into shippable phases. Android-first; iOS stays post-MVP.*

---

## Is this a redesign? No — a major *build*, not a *redesign*

The core loop (shoot → blind vote → close-day → gallery → PotD) is **untouched**. Everything here is additive, and the existing architecture was built to absorb it:

- Frames are already **config-not-art** → cosmetics scale as data, no release per item.
- `reactions.emoji` column is **already reserved** for nods / reaction packs.
- **RevenueCat** is already named in the stack; `profiles.is_premium` already exists.
- Thresholds / caps are already **config rows** → Pro perks and studio caps tune without deploy.
- **Studios** (spec's "Squads") and **Leagues** are already in the backlog (§21).

No existing screen is being rebuilt. New surfaces (a Studios area, paywall sheets, nods tags on the vote screen) attach to what's already there.

---

## The one sequencing law: retention before revenue

Monetization is **post-retention** (spec §17 + monetization plan). Build the features that *drive* retention first; switch paying on only once D7/D30 hold. Pro built into an app that doesn't retain is wasted work.

---

## Status — 2026-07-23

**Phase 0 and Phase 1 are effectively DONE. Live in closed testing (Play, build 6 · versionCode 6 · runtime `b166691a`).** Real users are shooting the daily Subject (Day 1 = 2026-07-23). Now in the **bake** window: run the closed test, watch retention, then decide Phase 2.

- **Shipped since the last roadmap:** PostHog analytics (+ build/OTA tracking) · schema align (prompts→subjects) · data export · full **Nods** (8 natural tags, category-tailored picker) · learning loop (hint / "Why this won" / journey stats) · Golden Shot · admin content + Subject-library calendar (66 Subjects) · **push notifications** (FCM, verified delivering — pulled forward from a later phase) · hearts = likes-only fix · ghost-submission guard · in-app **update prompt** · clean version display.
- **Pulled forward:** push notifications now work end-to-end (was P2/growth) — the FCM native build is done, so it's OTA-forever from here.
- **Deferred (native, need a build):** save-to-device (`expo-media-library` removed for Play policy) · **enable** social sign-in (modules baked into build 6, shipped disabled → flip on via OTA + credentials) · Sentry DSN (module native, inert until `EXPO_PUBLIC_SENTRY_DSN` set — OTA-class).
- **Play gate ahead:** personal Play accounts need closed testing with ≥12 opted-in testers running ≥14 continuous days before you can apply for production access. Track that 14-day clock — start it during the bake, not after.

**Next move:** let it bake / grow the closed test to 12+ testers, then **Phase 2 (Studios)** — or wire Sentry's DSN and enable social sign-in as quick launch-hardening while retention data accrues.

---

## Phases

### Phase 0 — Prep & launch hardening *(DONE, except deferred natives)*
**Goal:** measurable, reliable, compliant before feature work lands.
- [x] **Instrument** (PostHog) + baseline — live; also tags every event with `app_build` / `ota_update_id` for OTA-rollout visibility. *(build-steps §0A)*
- [x] **Align the schema** — `prompts`→`subjects`, `prompt_drops`→`subject_drops` shipped (0B). *(columns like `prompt_id` intentionally kept.)*
- [~] **Crash & error monitoring** (Sentry) — native module IS in the binary; **inert until `EXPO_PUBLIC_SENTRY_DSN` is set** (wire via OTA env, no build).
- [~] **Save your Shot to device** — **deferred**: `expo-media-library` was removed to satisfy Play's Photo & Video policy; re-add write-only when actually built.
- [x] **Data export ("Download my data")** — shipped (§12 companion to Delete Account).
- [~] **Finish social sign-in** (Apple/Google) — native modules **baked into build 6, shipped DISABLED**; enable later via OTA + Google/Apple credentials.

**Exit gate:** ✅ analytics live · schema aligned · export/delete work. (Sentry DSN + save-to-device deferred, not blocking.)

### Phase 1 — Content & recognition *(DONE)*
**Goal:** beat the BeReal boredom curve and reclaim the feedback payoff users love.
- [x] **Subject library** — **66 Subjects**, categorized (light/object/color/pov/absurd/emotion); weekly **Golden Shot** live.
- [x] **Curator Nods** — shipped, then upgraded: **8 natural tags**, universal vocabulary, picker tailored per Subject category (`nods` table + `submit_nod` + aggregate on `decorate_photos`). See [[nods-design]].
- [x] **Learning loop** — technique hint per Subject · "Why this won" PotD note · private "Your journey" stats. All live.
- [x] **Subject editorial calendar (admin)** — `/admin` (daily hint / Golden / PotD note) + `/admin-library` (Subject CRUD + scheduling). No more hand-run SQL.

**Exit gate:** D7/D30 + submissions/drop trending up on the alpha cohort — **now being measured** (Day 1 = 2026-07-23).

### Notifications — *(DONE this session, pulled forward from P2/growth)*
- [x] **Push delivery** — FCM configured, `push` edge function + server-side triggers (drop-live / reveal / PotD / follow) via a 2-min `notify_pending` sweep + `send_push` (Vault-keyed). **Verified delivering** to real devices. Per-type preferences + quiet mode still TODO (a settings surface, OTA-class).

### Phase 2 — Studios *(belonging + virality; biggest new social subsystem)*
**Goal:** friend-group retention + an invite-loop growth engine. Fair by design — reads global results, never a separate judged contest. Full spec in `feature-research.md` §4b.
- [ ] **2a — Group model:** `studios`, `studio_members`, invites/links; create → name → invite → join. Ship first with only a **shared studio streak** ("play together"). No scoring yet.
- [ ] **2b — Studio standing:** weekly standing derived from members' *global* results; "N of your studio made the gallery"; soft weekly standout. **No daily ranking, no peer voting.**
- [ ] **2c — Studio challenges (optional):** occasional studio-only theme, **hearts-only, unranked**, walled off from the fair game.

**Exit gate:** studios generating invites and lifting D30 for members.

### Growth loops *(thread alongside Phases 1–2, once retention shows signs of holding)*
- [ ] **Share profile — link or QR** + **shareable content deep-links** — share a Gallery / a single Shot / a Studio invite that opens the app to the right place. Base exists (`expo-linking`, scheme `piqa`); build the share cards + link routing.
- [ ] **Referral / invite-a-friend** — a tracked referral loop beyond share-profile.
- [ ] **App-store review prompt** (`expo-store-review`) — ask right after a PotD / gallery placement (a genuine happy moment). Free ratings.
- [ ] **Weekly recap — "your week in photos"** — a gentle re-engagement digest (positive-only, Law 3).

### Phase 3 — Monetization *(only after retention holds)*
**Goal:** revenue without touching the fairness firewall. Details in `monetization-plan.md`.
- [ ] **3a — Pipeline + cosmetics:** RevenueCat in the EAS build; entitlement → webhook → Supabase `is_premium` (server-side truth); ship **cosmetics only first** (frames / rings / reaction packs) — lowest-risk validation of the whole chain. Include **Restore Purchases + Manage Subscription** — Apple/Google require both.
- [ ] **3b — Piqa Pro:** subscription (archive retention + stats + 2 shields/mo); **soft, contextual** paywall; PostHog funnel + first A/B. Defuse the archive-retention stick first (monetization §7).
- [ ] **3c — Rest of the catalog:** consumables (shields, archive top-ups) · **studio cosmetics** (Director-gifted) · studio-size valve · Pro studio stats.

**Exit gate:** healthy trial→paid; net revenue per retained user positive.

### Phase 4 — Depth & reach *(later)*
- [ ] Showcase (§21 #1) · opt-in **Leagues** (§21 #5) · Collections · Studios polish.
- [ ] **Localization / i18n** — framework + EN + a PH locale (you're "global from day one" but nothing's installed; do before scaling beyond EN).
- [ ] **Accessibility pass** — screen-reader labels, dynamic type, reduced-motion (spec gestures at it; make it a tracked deliverable).
- [ ] **Sponsored Shots** — parked until real DAU (monetization §9).
- [ ] iOS.

---

## Dependencies & risk notes
- **Phase 3a unblocks everything paid** — do it as one clean slice (cosmetics) before Pro.
- Phase **2b** depends on per-user close-day results being queryable — they already are.
- **Nods (1)** and **studio standing (2b)** both read voting/results data — build the Nods schema first and reuse the pattern.
- Every phase is **independently shippable to the closed test** — don't batch them into one big release.

## Recommended next move *(updated 2026-07-23)*
Phase 0 + 1 shipped and notifications are live. **The bottleneck is now data, not code:** run the closed test, grow it to the **12+ testers × 14 days** Play requires, and watch whether D7/D30 + submissions/drop hold. While that bakes, the cheap launch-hardening wins are: **wire the Sentry DSN** (OTA env, catch crashes on real devices) and **enable social sign-in** (modules already baked in). Once retention shows signs of holding → **Phase 2 (Studios)**. Monetization stays last.
