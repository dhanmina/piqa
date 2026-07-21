# Piqa — Feature Plan from Competitor Reviews

*Draft · Jul 2026 · Piqa is pre-launch, so this mines reviews of the apps Spec §18 names — GuruShots, BeReal, ThemeSnap, SnapQuest, VIEWBUG, Picfex. **Bad reviews = what to avoid; good reviews = what to adopt.** Every recommendation is checked against the Design Laws (§0) — a feature users beg for that breaks a law is still a no.*

---

## 1. What KILLS these apps (bad reviews → what Piqa must hold or fix)

| Complaint (competitor) | Root cause | Piqa's position |
|---|---|---|
| **Pay-to-win** — swaps/keys/turbo/boosts decide winners (GuruShots, 1.6★) | Money touches outcomes | ✅ Constitutionally banned (§0 Law 1, monetization plan). This is our whole thesis — **market it loudly.** |
| **Off-topic / poorly-composed photos win** via timing + spend (GuruShots) | Popularity + money ranking | ✅ Blind Bradley-Terry + camera-only kills it. |
| **"It got boring / pointless"** — novelty wore off (BeReal: 73.5M → 40M) | No content engine, no sense of progress | ⚠️ **Existential.** Our answer (editorial Subject library, skill curriculum, events) is spec'd but must actually ship strong. See P0. |
| **Notification stress** — 2-min pressure, "snitching," always-on (BeReal) | Urgency as punishment | ✅ "Urgency is a reward, never a punishment" (Law 7) + capture-time-counts. Add explicit **notification controls.** |
| **One gimmick got copied** (BeReal dual-camera) | Feature, not a system | ✅ Our moat is the *system* (fairness + finiteness), not one trick. Keep iterating the Subject product. |
| **Privacy** — anyone can grab your photos (GuruShots) | Weak ownership model | ✅ Private archive, signed URLs, location stripped. **Say it in onboarding** — it's a trust asset. |
| **Advanced users dominate; beginners don't belong** | No skill tiers | ⚠️ Blind judging helps, but a flat "top 20% gallery" can still shut newbies out. See P1 Leagues. |
| **Bugs, crashes, online-only features, poor support** | Reliability + no feedback channel | ✅ Offline-first is a differentiator. Add an **in-app feedback/support** path. |

---

## 2. What users LOVE (good reviews → what to adopt)

| Praise | Piqa today | Action |
|---|---|---|
| **Feedback & recognition** — "300 vote-ups feels great," valuable feedback | Hearts + "picked N times" only; comments banned | 🎯 **The #1 gap — see §3.** |
| **Fair judging decides, not likes-addiction** | Core mechanic | Lead the store listing with it. |
| **Gamification & progression** (levels, badges) | XP/levels/streaks/PotD badges | ✅ Have it; keep quiet-mode. |
| **Teams / community** (GuruShots teams loved) | Studios (spec §21 #3 "Squads") | ⬆️ **Promote Studios** (P1). |
| **Rich photo info / EXIF** | Have it | ✅ Keep. |
| **Learning — "each challenge makes me better"** | Subject curriculum is spec'd, not surfaced | 🎯 **Build the learning loop** (P1). |
| **Emotional payoff / sense of progress** | Win moment + best-finish | Extend into a visible growth story (P1). |

---

## 3. The headline opportunity — recognition WITHOUT comments

Across **every** competitor the single most-loved thing is feedback and recognition ("it feels great to get 300 vote-ups"), and the single most-common toxicity/anxiety source is **comments + visible popularity**. Piqa banned comments (Law 3) to dodge the toxicity — but that also throws out the payoff users crave. **Reclaim the payoff without the poison.**

**Proposed: "Curator Nods" — bounded, positive-only, no free text.**
- When a curator picks your photo, they can optionally attach **one tag from a fixed set** — e.g. *Great light · Strong composition · Bold color · Perfect timing · Made me feel something.*
- You see an aggregate on your shot: "❤ 240 · 🏷 Great light ×38, Strong composition ×21." Signed appreciation, never a number that can shame.
- **No free text → no harassment vector, ever.** Finite set → no infinite surface. Positive-only by construction.

**Why it's law-safe:** signed appreciation (Law 6), positivity-only (Law 3, losses never shown), finite (Law 2), invisible to the blind vote (tags attach *after* the pick is cast, never shown during judging). It is the emotional payoff of comments with none of the IG-anxiety the never-do list forbids.

**Bonus — the learning angle:** nods tags double as free skill feedback ("people keep saying my *light* is strong"), and a **"Why this won" PotD note** (one editorial line on the winning shot) turns the daily reveal into a lesson — directly answering the "I want to improve" reviews and BeReal's boredom death.

---

## 4. Prioritized feature plan

Priority is by review evidence × law-fit × retention impact. Effort is rough.

### P0 — Existential (BeReal died here)
- [ ] **Subject library as a living product** — 60+ Subjects at launch, rotating categories, **weekly Golden Shot + monthly themed events.** Spec'd (§3); this is survival, not polish. *Effort: ongoing editorial.*
- [ ] **Curator Nods** (§3) — reclaim the recognition payoff, comment-free. *Effort: M. Schema: extend `reactions` / a `nods` table with a fixed tag enum.*

### P1 — Belonging & progression (anti-domination + "make me better")
- [ ] **Studios — friend groups** (§21 #3) — a Director creates a named group, invites friends, they compete **on the global Subject**, aggregated into a private studio standing/streak. Teams are the most-loved GuruShots feature; friend-groups are the warmer, self-selected answer to "beginners don't belong." **Full spec §4b. Rank above Leagues.** *Effort: L.*
- [ ] **Opt-in Leagues / skill tiers** — so "top 20%" doesn't permanently shut beginners out; rookies compete with rookies. Backlog (§21 #5). Keep opt-in + positive (Law 3). *Effort: L.*
- [ ] **The learning loop** — surface the stealth curriculum: a technique hint per Subject, "Why this won" on the PotD, a private "your growth" view (best finishes over time). *Effort: M.*

### P2 — Trust & polish
- [ ] **Showcase** (§21 #1, already next) — the pull-surface for best shots.
- [ ] **Notification controls** — granular, gentle, off-able. Directly answers BeReal's #1 complaint. *Effort: S.*
- [ ] **Privacy/ownership trust** — onboarding line + no-download/watermark on public shots; make "your photos are yours" explicit. *Effort: S.*
- [ ] **In-app feedback/support channel** — a lightweight "report a bug / suggest a Subject" path; competitors bleed users over silence. *Effort: S.*

### Deliberately NOT building (users ask, laws forbid)
- **Free-text comments** — the toxicity + IG-anxiety engine. Curator Nods replaces the need. (§21 keeps it only as a distant creator-opt-in maybe.)
- **Visible follower/vote counts, leaderboards beyond PotD** — converts wins into losses (Law 3). Leagues stay opt-in and private-facing.

---

## 4b. Studios — feature spec (the friend-group mode)

**Concept.** A Director creates a **named group**, invites friends, and they play Piqa together. Crucially, they compete on the **same global daily Shot as everyone else** — the studio is a *social lens* on the global blind results, **never a separate judged contest.**

**Guardrails that keep it fair (the whole reason it works):**
- **No separate judged Subject.** A parallel group Subject = a "second daily Shot," which §0's never-do list forbids — and a 5–8-person group can't judge blind-fairly anyway. One shot, shared by the world.
- **No peer voting.** Friends recognize each other's photos → not blind, collusion-prone. Judging stays with the global anonymous crowd (Bradley-Terry); the studio only *reads* those results.
- **Collaborative-first, not a humiliation ladder.** No daily 1–N ranking of friends (Law 3: numbers convert wins into losses).

**What members see:**
- **Shared studio streak** — the studio keeps its flame if enough members submit each week.
- **Weekly studio standing** derived from members' *global* outcomes (gallery placements, hearts, any PotD): "**4 of your studio made the gallery today.**"
- A soft, rotating **weekly standout** — never a brutal daily ordinal.
- Optional **non-competitive studio challenges** — an occasional studio-only theme, **hearts only, no winner**, explicitly *fun* and walled off from the fair game.

**Roles** (see `lexicon.md`):
- **Director** (creator) — create, name, invite/remove, buy studio cosmetics (benefit all), manage. First mover is the Director.
- **Studio member** — joins via invite; contributes to the studio streak/standing. Collectively "the Studio."

**Growth loop.** Named studio + invite links + a Director-bought badge the whole studio wears = built-in acquisition and flex. Likely the strongest D7/D30 + virality lever in the backlog.

**Monetization** (see `monetization-plan.md` §3b): **free to create/join/compete.** Sell *around* it — studio cosmetics (Director-gifted), a studio-size valve (free ≤ ~8), Pro studio stats/history. **Never gate participation.**

**Schema sketch:**
- `studios(id, name, cosmetic_id, director_id, created_at)`
- `studio_members(studio_id, user_id, role, joined_at)` — pk `(studio_id, user_id)`
- `studio_invites(studio_id, code, inviter_id, expires_at)` — or link-based
- Studio standings **derived** from `submissions` ⨝ membership (or a weekly-materialized `studio_scores` for cheap reads) — never a separate ranking store.

**Open decisions:**
- Free studio-size cap (8?) and whether a user can belong to multiple studios.
- Weekly scoring formula — gallery placements vs hearts vs a blend.
- Name: **Studio · Roll · Darkroom · Collective** (lean Studio or Roll).
- Signed vs aggregate studio standings — recommend collective/aggregate (per §5).

**Never (recorded guardrails):** separate judged group Subject · peer/friend voting · visible daily friend ranking · paywalling participation.

---

## 5. The one tension to decide
**Curator Nods vs. "appreciation is signed" (Law 6).** Hearts are signed today (the photographer sees who reacted). Decide whether nods tags are also **signed** (curator's name shown) or **anonymous-aggregate** (just counts). Recommendation: **anonymous-aggregate** — it keeps the warmth and the learning signal without turning tags into a popularity ledger or a pressure to reciprocate. Signed hearts already carry the personal connection; nods carry the *craft* signal.

---

## 6. One-line summary
Piqa's fairness laws already inoculate it against what kills competitors (pay-to-win, popularity toxicity, notification stress). The growth unlock is to **reclaim the one good thing those apps have that Piqa gave up — recognition and feedback — in a comment-free, positive-only, finite form (Curator Nods + a learning loop)**, then ship the content engine (Subjects + events) hard enough to outlast the novelty curve that killed BeReal.
