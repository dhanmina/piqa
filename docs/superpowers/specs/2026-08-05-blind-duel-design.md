# Blind Duel — design spec

Date: 2026-08-05
Status: approved by user, pending implementation plan

## Problem

piqa's core loop (daily prompt → one shot → blind curation → reveal) has no
mechanic that drives outside installs. The obvious shareable moment — "I won
today" — only serves the small fraction of users who actually rank near the
top. A rank-gated share card excludes most users from ever having a reason to
post, so it can't be the app's install-driving feature.

## Goal

A shareable moment that:
- works for every submitter, not just top finishers (rank-independent)
- is genuinely novel outside the crowded photo-sharing space (not "another
  Instagram Story card")
- reuses the existing blind-curation mechanic instead of inventing a parallel
  system
- keeps the fairness firewall intact — anything an outsider does must never
  touch real gallery ranking

## Concept: Blind Duel

Every submitted shot gets a shareable duel link. The sender sends it to a
friend outside the app. The friend opens the link and blind-votes between the
sender's shot and a random other entry from the same day's pool — no
signup, no install required to vote. After voting, the friend sees the
result and a soft prompt to try piqa themselves. The sender gets a live ping
("3 people just judged your duel") and a running crowd-score tally.

Why this works:
- **Curiosity gap** — "which one is mine?" is inherently more shareable than
  "look at my photo," because the friend has to engage to find out.
- **Zero friction to vote** — most link-shares die at the install wall; this
  removes it entirely for the voting action.
- **FOMO** — the duel expires when the day's real voting closes, same as the
  rest of the daily cycle, so links go stale on purpose instead of farming
  votes forever.
- **Rank-independent** — every submission can be duelled, so the share
  action isn't gated behind winning.
- **Reciprocity loop** — the "someone just voted" ping pulls the sender back
  into the app, and a voter who liked the exercise has a natural next step
  (install, submit their own shot).

## Architecture

**New tables** (separate from the real `votes` table, by design — see
Fairness firewall below):
- `duels` — id, submission/photo id, opponent submission id, created_by,
  expires_at (mirrors the day's `voting_closes_at`)
- `duel_votes` — duel id, voter fingerprint (device/browser fingerprint,
  not an account), pick, created_at

**Public RPC** (anon-key callable, no auth required — mirrors the pattern
already used by `get_matchup` / `cast_vote` in `lib/services/matchup.ts`,
but exposed for unauthenticated web callers):
- `get_duel(duel_id)` — returns the two blind, signed thumb URLs. No names,
  levels, or metadata, matching the in-app curation screen's blindness.
- `cast_duel_vote(duel_id, pick, fingerprint)` — rate-limited to one vote per
  duel per fingerprint, enforced server-side.

**Opponent selection**: same fairness rule as the internal matchup pool — a
random shot from the same day's pool. No "pick your rival"; this stays a
blind exercise, not a targeted callout.

**New web route**: `src/app/duel/[id].tsx`, public and unauthenticated.
Reuses the existing `web.output: "static"` Expo Router config — the app
already builds a static web target, it's just unhosted. Real infra work
required:
- Host the static web build somewhere (Vercel or Cloudflare Pages free tier
  are the obvious low-cost fits for a solo dev)
- Wire `joinpiqa.com` to that host — currently unhosted per the existing
  comment in `lib/utils/share.ts` ("no web landing at joinpiqa.com yet")
- Add OG meta tags to the duel page for a link-preview teaser (a blurred or
  split-image preview reinforces the curiosity gap before the tap)

## Fairness firewall

Duel votes must never influence real gallery ranking or the curator vote
pool. Outside voters aren't verified photographers, aren't rate-limited the
same way as in-app curators, and are trivially bot-able or brigade-able by a
sender's friend group. Keeping `duel_votes` fully separate from `votes`
preserves the existing guarantee that gallery placement reflects blind
curator judgment, not a popularity contest — the same principle that
already makes hearts reaction-only rather than ranking signal.

Duel results surface only as a vanity stat: a "crowd score" (e.g. "Duel
record: 12W–4L") shown on the sender's own profile, visually and
structurally separate from real votes/rank.

## In-app touchpoints

- Share button appears in two places: the Today submitted state, and the
  reveal/result screen — "Send this as a duel"
- Profile gains a crowd-score stat, kept separate from the existing
  votes/rank/level sections so it reads as a distinct, lower-stakes number
- Toast/push notification when someone votes a sender's duel ("3 people just
  judged your duel") — the reciprocity hook that pulls the sender back into
  the app between daily drops

**Cut from v1** (explicit non-goals, revisit only if v1 proves the loop):
- Comments on duels
- Custom opponent selection ("pick who you're up against")
- Video duels
- A duel history/feed screen
- Voter accounts — voting stays anonymous/fingerprint-based, no signup flow

## Anti-abuse

- One vote per duel per fingerprint, enforced in `cast_duel_vote` server-side
  (not just client-side throttling)
- Duel expires at the same `voting_closes_at` as the day's real round —
  bounds the abuse window and reinforces urgency
- Opponent is always a random pool entry, never sender-chosen, closing off
  the "duel a specific person to harass them" vector

## Rollout / testing

- Ship behind the existing `getConfig` feature-flag pattern (same mechanism
  used for `quick_draw_minutes`, `vote_cap`, etc.), soft-launch to a subset
  first
- Track: duel-share rate per submission, vote-to-install conversion (needs a
  referral/UTM param on the duel link), fingerprint-based abuse rate
- Manual QA: confirm a duel vote never appears in the real curator vote
  count or gallery ranking for that photo

## Open questions for the implementation plan

- Exact fingerprinting approach for the anonymous web voter (cookie-based
  vs. browser fingerprint library) — needs a privacy-conscious pick that
  still resists trivial multi-vote abuse
- Hosting choice for the static web build (Vercel vs. Cloudflare Pages) and
  how it fits the existing EAS/Supabase deploy pipeline
- Referral/UTM param format for measuring vote-to-install conversion
