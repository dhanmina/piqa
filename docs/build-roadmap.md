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

### Phase 1 — Content & recognition *(retention core; cheap, high impact)*
**Goal:** beat the BeReal boredom curve and reclaim the feedback payoff users love.
- [ ] **Subject library** to 60+, categorized; weekly **Golden Shot** + event scaffolding (event dates/labels already exist for event frames).
- [ ] **Curator Nods** — fixed positive-tag set, attached when a curator picks; aggregate shown on the photo. Schema: `nods(voter_id, submission_id, tag)` (or extend `reactions`).
- [ ] **Learning loop** — a technique hint per Subject · a "Why this won" line on the PotD · a private "your growth" view (best finishes over time, from existing data).

**Exit gate:** D7/D30 + submissions/drop trending up on the alpha cohort.

### Phase 2 — Studios *(belonging + virality; biggest new social subsystem)*
**Goal:** friend-group retention + an invite-loop growth engine. Fair by design — reads global results, never a separate judged contest. Full spec in `feature-research.md` §4b.
- [ ] **2a — Group model:** `studios`, `studio_members`, invites/links; create → name → invite → join. Ship first with only a **shared studio streak** ("play together"). No scoring yet.
- [ ] **2b — Studio standing:** weekly standing derived from members' *global* results; "N of your studio made the gallery"; soft weekly standout. **No daily ranking, no peer voting.**
- [ ] **2c — Studio challenges (optional):** occasional studio-only theme, **hearts-only, unranked**, walled off from the fair game.

**Exit gate:** studios generating invites and lifting D30 for members.

### Phase 3 — Monetization *(only after retention holds)*
**Goal:** revenue without touching the fairness firewall. Details in `monetization-plan.md`.
- [ ] **3a — Pipeline + cosmetics:** RevenueCat in the EAS build; entitlement → webhook → Supabase `is_premium` (server-side truth); ship **cosmetics only first** (frames / rings / reaction packs) — lowest-risk validation of the whole chain.
- [ ] **3b — Piqa Pro:** subscription (archive retention + stats + 2 shields/mo); **soft, contextual** paywall; PostHog funnel + first A/B. Defuse the archive-retention stick first (monetization §7).
- [ ] **3c — Rest of the catalog:** consumables (shields, archive top-ups) · **studio cosmetics** (Director-gifted) · studio-size valve · Pro studio stats.

**Exit gate:** healthy trial→paid; net revenue per retained user positive.

### Phase 4 — Depth *(later)*
- [ ] Showcase (§21 #1) · opt-in **Leagues** (§21 #5) · Collections · Studios polish.
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
