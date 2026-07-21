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

## Phases

### Phase 0 — Prep & launch hardening *(do first; some are compliance)*
**Goal:** measurable, reliable, compliant before feature work lands.
- [ ] **Instrument** (PostHog funnels + retention dashboard) and **baseline** the alpha — the measuring stick for every exit gate. *(build-steps §0A)*
- [ ] **Align the schema** — rename `prompts`→`subjects`, `prompt_drops`→`subject_drops`, and `votes.voter_id`→`curator_id` while the DB is tiny. *(build-steps §0B)*
- [ ] **Crash & error monitoring** (Sentry) — nothing catches crashes today; critical on budget Android + the offline queue.
- [ ] **Save your Shot to device** (`expo-media-library`) — basic photo-app expectation, currently missing.
- [ ] **Data export ("Download my data")** — the privacy-right companion to the existing Delete Account (§12).
- [ ] **Finish social sign-in** (Apple/Google) — in progress on `oauth-social-login`; Apple Sign-In becomes mandatory once iOS ships.

**Exit gate:** analytics live · schema aligned · crash reporting on · export/delete both work.

### Phase 1 — Content & recognition *(retention core; cheap, high impact)*
**Goal:** beat the BeReal boredom curve and reclaim the feedback payoff users love.
- [ ] **Subject library** to 60+, categorized; weekly **Golden Shot** + event scaffolding (event dates/labels already exist for event frames).
- [ ] **Curator Nods** — fixed positive-tag set, attached when a curator picks; aggregate shown on the photo. Schema: `nods(curator_id, submission_id, tag)` (or extend `reactions`).
- [ ] **Learning loop** — a technique hint per Subject · a "Why this won" line on the PotD · a private "your growth" view (best finishes over time, from existing data).
- [ ] **Subject editorial calendar (admin)** — schedule Subjects, the weekly Golden Shot, and events. §3 makes the Subject library a first-class editorial product, so it needs an admin surface, not ad-hoc rows — and it's what keeps the anti-boredom bet fed.

**Exit gate:** D7/D30 + submissions/drop trending up on the alpha cohort.

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

## Recommended first move
Start with **Curator Nods + the PotD "Why this won"** (Phase 1). Smallest surface, no new infra, directly targets the #1 loved feature and the boredom risk — and it makes the *current* alpha stickier while you watch retention. Studios next, monetization last.
