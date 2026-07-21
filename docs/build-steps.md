# Piqa — Step-by-Step Build Strategy

*Draft · Jul 2026 · the **execution** companion to `build-roadmap.md` (which holds the strategy/phasing/gates). This breaks each phase into ordered engineering steps, in the app's own grain: **data → server (RPC) → client lib → UI → test → ship.** Uses the locked `lexicon.md` names.*

**Rules for every phase**
- One phase = **one shippable slice** to the closed test. Never batch.
- Server owns every earned value (`is_premium`, standings, results, Nod aggregates) — the client **reads**, never asserts.
- New tables use the locked names (`studios`, `studio_members`, `nods`). Core tables `prompts`/`prompt_drops` are **renamed** to `subjects`/`subject_drops` in Phase 0B — every feature phase below assumes the new names.
- Don't start a phase before the prior **exit gate** (in the roadmap) is met.

---

## Phase 0 — Prep (do first) · *small*

### 0A · Instrument (so the gates are real)
You can't gate on "D7/D30 trending up" without measuring it. This is the measuring stick for every later phase.
1. **PostHog events** on the core loop: `shot_entered`, `curate_set_completed`, `reveal_seen`, `result_seen`, `gallery_opened`.
2. **Retention dashboard:** D1/D7/D30, submissions per drop, Curators per drop.
3. **Baseline** the current alpha for ~1–2 weeks → this is your control group for everything after.
- **Ship:** nothing user-facing; you now have the baseline.

### 0B · Align the schema to the lexicon *(do before any feature phase)*
Rename the core concept's tables now, while the DB is tiny — a code↔product mismatch on the central concept is confusing forever, and alpha is the cheapest fix.
1. **Migration (one transaction):** `ALTER TABLE prompts RENAME TO subjects;` · `ALTER TABLE prompt_drops RENAME TO subject_drops;` · rename FK column `subject_drops.prompt_id → subject_id` · rename `votes.voter_id → curator_id` (Curator is the voting role). Postgres keeps data + FKs; dependent FKs auto-follow.
2. **`CREATE OR REPLACE` every function** that references the old names — `get_gallery`, `close_day`, `get_active_prompt` (→ `get_active_subject`), `decorate_photos`, `get_home_state`, the `drop-prompt` cron (→ `drop-subject`), and the vote/matchup RPCs that read `voter_id`. Same migration, so nothing is broken mid-way.
3. **Regenerate types** (`supabase gen types`); update client `.from("prompts")` / `.rpc("get_active_prompt")` call sites to the new names.
4. **Test the full loop** on a preview/branch DB before pushing.
- **Caveat:** the DB migration and the client update must ship **together** (coordinated release) — table renames aren't OTA-able.
- **Ship:** no user-facing change; the schema now matches the product. Every feature phase after this uses the clean names.

---

## Phase 1 — Content & Recognition

### 1A · Subject library + Golden Shot *(content engine — existential)*
1. **Content:** write 60 Subjects into `subjects` (renamed in 0B), tagged by category (object/color/light/POV/emotion/absurd).
2. **Golden Shot:** add a weekly flag/event marker; schedule via the existing drop cron.
3. **UI:** none required (Subjects flow through the existing Shot pipeline); optional gold treatment on the Today card for the Golden Shot.
4. **Test:** rotation has no repeats; Golden Shot lands weekly.
- **Ship** · buffer ≥ 8 weeks of Subjects.

### 1B · Nods *(the flagship — craft recognition)*
1. **Migration:** `nods(curator_id, submission_id, tag, created_at)`; `tag` is a **fixed enum** (`great_light`, `strong_composition`, `bold_color`, `perfect_timing`, `moved_me`). RLS: insert-own; aggregates readable. Unique `(curator_id, submission_id)`.
2. **Server:** attach point is the **pick** — a Curator may add ≤1 tag *after* casting the pick, **never during the blind pair**. Extend `decorate_photos` to return per-photo Nod aggregates.
3. **Client:** `lib/nods.ts` — submit tag, read aggregates.
4. **UI:** one-tap tag picker on the pick-confirm; on your own photo / detail show **"Curators nodded: Great light ×38."**
5. **Test:** no free-text path exists; aggregates correct; tags invisible during judging.
- **Ship.**

### 1C · Learning loop
1. **"Why this won":** a `potd_note` (one editorial line), set at `close_day` or admin; shown on the Reveal.
2. **Technique hint per Subject:** add `hint` to `subjects`; show on the Today Shot card.
3. **"Your growth":** a private profile view of best finishes over time (stats RPC over `submissions` history).
- **Ship.**

**→ Exit gate:** D7/D30 + submissions/drop up vs the Phase 0 baseline. *Only then continue.*

---

## Phase 2 — Studios

### 2A · Group model *(create / invite / play together)*
1. **Migrations:** `studios(id, name, cosmetic_id, director_id, created_at)` · `studio_members(studio_id, user_id, role, joined_at)` · `studio_invites(studio_id, code, inviter_id, expires_at)`. RLS throughout.
2. **RPCs:** `create_studio`, `join_studio(code)`, `leave_studio`, `list_my_studios`.
3. **Client:** `lib/studios.ts` + hooks.
4. **UI:** a Studios surface (section in the Gallery/Following area), create→name→invite-link→join, member list, **shared studio streak**.
5. **Test:** invite flow, membership, streak keeps/breaks correctly.
- **Ship** · studios exist and play together (no scoring yet).

### 2B · Studio standing *(weekly, from GLOBAL results)*
1. **Server:** weekly-materialized `studio_scores` (or derive on read) from members' **global** outcomes — reuse `close_day` outputs (gallery placements, hearts, PotD). **No peer voting, no separate judging.**
2. **UI:** weekly standing · "**4 of your Studio made the Gallery today**" · soft weekly standout. **No daily 1–N ladder** (Law 3).
3. **Test:** guardrails hold — judging is untouched; no daily ranking surface exists.
- **Ship.**

### 2C · Studio challenges *(optional, non-competitive)*
1. A studio-only Subject, **hearts-only, unranked**, walled off from the fair game. Build only if 2A/2B land.

**→ Exit gate:** studios generating invites + lifting D30 for members.

---

## Phase 3 — Monetization · *only after retention holds*

### 3A · Pipeline + cosmetics *(lowest-risk validation)*
1. Install **RevenueCat** (`react-native-purchases`) in the EAS build; define entitlements + cosmetic products (frames / rings / reaction / Nod packs) in the dashboard.
2. **Webhook:** RevenueCat → Supabase edge function → set `is_premium` / owned cosmetics **server-side**. Client never asserts.
3. **Client:** entitlement check gates cosmetic ownership; a cosmetics paywall sheet.
4. **Ship cosmetics only first** — proves the whole chain end-to-end.

### 3B · Piqa Pro
1. Products: **monthly + discounted annual + trial**.
2. Gate archive-retention + stats + shields on the entitlement (**server-enforced**). **Defuse the retention stick first** (`monetization-plan.md` §7).
3. **Soft, contextual** paywall (archive about to lose full-res; stats view). PostHog funnel + first A/B.

### 3C · Rest of the catalog
1. Consumables (shields, archive top-ups) · **Studio cosmetics** (Director-gifted) · studio-size valve · Pro studio stats.

**→ Exit gate:** healthy trial→paid; net revenue per retained user positive.

---

## Phase 4 — Depth · *later*
Showcase (§21 #1) · opt-in Leagues (§21 #5) · Collections · Studios polish · **iOS**. Sponsored Shots parked until real DAU.

---

## Backend / data layer — consolidated view
**Not a redesign — additive.** The existing architecture (materialized galleries, `config` rows, RPC-per-screen, RLS) absorbs all of it. Every backend change in one place:

**New tables** (all with RLS)
- `nods(curator_id, submission_id, tag, created_at)` — insert-own, aggregate-read.
- `studios(id, name, cosmetic_id, director_id, created_at)`
- `studio_members(studio_id, user_id, role, joined_at)`
- `studio_invites(studio_id, code, inviter_id, expires_at)`
- `studio_scores(studio_id, week, score, gallery_count, …)` — weekly-materialized (or a view).
- *(Phase 3, optional)* `purchases` audit log — RevenueCat stays source of truth.

**Tables renamed `subjects` / `subject_drops`** in **Phase 0B** so code matches the product — done once while the DB is tiny (columns below use the new names).

**Altered columns** (add, don't migrate)
- `subjects.hint` (technique hint — a property of the *theme*).
- `subject_drops.is_golden` (this *day's* drop is the weekly Golden Shot — a per-drop event, so it lives on `subject_drops`, not `subjects`).
- PotD note: `submissions.potd_note` (or a small `potd` row).
- Cosmetics ownership: reuse `user_frames`; generalize to `user_cosmetics` only if selling reaction/share packs.

**RPCs — extend, don't rebuild**
- `decorate_photos` → include per-photo **Nod aggregates**.
- `close_day` → also bake Nod aggregates into the gallery blob · recompute `studio_scores` · set `potd_note`.
- `get_gallery` → carries Nod aggregates **for free** once `close_day` bakes them into the blob.
- New: `submit_nod`, `create_studio`, `join_studio`, `leave_studio`, `list_my_studios`, `get_studio_standing`.

**Crons**
- `close_day` (8am) — extended as above.
- Retention cron (30-day thumb-drop) → **respect `is_premium`** (Pro keeps full-res) + honor Stars/top-ups.
- Weekly `studio_scores` materialization (or fold into `close_day`).

**Edge functions**
- **RevenueCat webhook** → set `is_premium` / owned cosmetics server-side (Phase 3).

**Architecture rules to preserve**
- **Bake Nod aggregates + studio standings into the materialized blobs at `close_day`** — keep the "morning rush reads a cached blob, zero live queries" property (spec §14). Never live-query `nods` on every gallery open.
- Server owns every earned value (`is_premium`, standings, aggregates); the client only reads.

**Untouched (structurally)** — `submissions`, `votes`, the Elo + Bradley-Terry math, and the materialized-gallery serving model. `subject_drops` is renamed (0B) and gains an additive `is_golden` flag, but its structure and role are unchanged. Extended, never replaced.

---

## Dependency map (what unblocks what)
- **Phase 0** unblocks every exit gate (measurement).
- **1B Nods schema** establishes the "attach-to-pick + aggregate" pattern that **2B standings** reuses — build Nods first.
- **3A pipeline** unblocks all paid work — one clean cosmetics slice before Pro.
- **2B standings** reuses `close_day` per-user outputs (already exist).

## First move
Phase 0 (instrument) in parallel with **1B Nods + 1C "Why this won"** — smallest surface, no new infra, targets the #1 loved feature and the boredom risk, and makes the *current* alpha stickier while the baseline builds.
