# PIQA — Product Spec v3 (FINAL — Complete Build Reference)

*July 11, 2026 · Android-first · Global from day one*
*Contains: product design laws · brand · daily cycle · ranking math · serving architecture · schema · moderation · monetization · competitive position · design system · IA per tab · component kit · stack decisions · build plan. This document + piqa-logo-kit.zip = everything needed to build.*

---

## 0. Design Laws (govern every future decision)

1. **Fairness** — blind judging, no paid advantage, exposure NEVER tied to votes cast. The day money or popularity touches outcomes, Piqa becomes GuruShots (1.6★).
2. **Finiteness** — bounded everything. Every "can I do more X?" gets a *bounded* release valve, never an unlimited one. No infinite feed, ever.
3. **Positivity** — losses never shown, comments don't exist, follower counts hidden, lapsed users only receive rewards. Loss aversion applies only to engaged users.
4. **The IG test** — if a change makes Piqa more like Instagram, Instagram already won that game. Serve urges through archive/profile/pull surfaces, never a feed.
5. **Shooting is free, the stage is scarce.** Unlimited capture, one public slot/day.
6. **Judgment is anonymous, appreciation is signed.**
7. **Urgency is a reward, never a punishment.** (Quick Draw bonus yes; late penalty no.)
8. **North star = D1/D7/D30 retention + submissions per drop. Never session length.**

**Never-do list:** second daily Shot for engagement's sake · infinite surfaces · guilt pushes · selling votes/placement · sound effects · visible ranks beyond PotD · comments (v1) · DMs · follower counts · location on profiles.

---

## 1. Brand

| | |
|---|---|
| Name | **Piqa** (pee-ka) — "pick" + "pic" |
| Tagline | One shot. Every day. |
| Slogan | Got the shot? |
| Store subtitle | Daily photo challenge game |
| User-facing word for the daily challenge | **"Today's Shot"** (never "prompt" in UI — AI connotation). `prompts` stays as internal table name. |
| Domain | **joinpiqa.com** ($11.28/yr) |
| Positioning | *The fair daily photo game — blind-judged, finite, no feed, no followers, works offline.* |

Vocabulary lives in photography's world: Shot, Camera, Gallery, Curator, Archive, Showcase. Voters = **Curators** (never "judges"). Verb in UI = "pick."

TODO before coding: buy joinpiqa.com · @piqa handles (TikTok/IG; fallback @piqaapp) · IPOPHL search classes 9 & 42 · bundle ID **`com.joinpiqa.piqa`** (brand-tied, permanent — never a personal name).

---

## 2. The Daily Cycle (per region)

| Time (local) | Event |
|---|---|
| ☀️ 9:00am | **Yesterday's gallery + PotD revealed** ("morning paper" push) |
| 🎲 Random, 9am–9pm | **Today's Shot drops** (push, jittered over 10–15 min) |
| Drop → midnight | Submitting open (⚡ Quick Draw XP bonus if <30 min) |
| Drop → 8:00am next day | **Curating open** (starts at drop, overnight tail exists only so late entries collect fair votes — nobody is expected awake) |
| 8:00am | `close-day`: rank → gallery flagged → streaks/XP |
| 9:00am | Reveal. Cycle repeats. |

- Schema: `submit_closes_at` (midnight) + `voting_closes_at` (8am) — two timestamps.
- Shooting and curating run **in parallel** all afternoon/evening; a user can be fully done 5 minutes after the drop.
- World gallery unlocks after the LAST region closes (no prompt leaks to later regions).

## 3. Prompts & Regions

- **One Shot per calendar day, worldwide** — same `prompt_id`, three region buckets (APAC / EU-Africa / Americas), each with its own randomized drop time. The Shot follows the sun.
- Voting in-region while live (same daylight); final gallery combines regions.
- Region locked from device timezone at signup; changeable 1×/month.
- **Prompt library is a first-class editorial product** (BeReal died of content boredom / novelty-without-iteration). Rotate categories: object / color / light / POV / emotion / absurd. Stealth photography curriculum inside categories (PhotoQuest lesson). Weekly review of which categories yield good galleries. **Write 60 prompts before launch** (2-month buffer). Weekly "Golden Prompt" event; monthly themed events; community-suggested prompts post-traction.

## 4. Capture Rules

- **In-app camera ONLY.** No gallery uploads. Kills stolen photos, most AI images, off-topic archives (GuruShots' plague); enforces "shot today."
- **Free shooting, unlimited, 24/7** → private archive. The camera never closes; the creation urge always has an in-app outlet.
- Any free shot taken **in-app today** can be promoted as today's entry before midnight.
- **One frame — 4:5 portrait.** Every shared photo is cropped to 4:5 (center-crop, exactly what the capture preview shows) and baked into the uploaded bytes, so what you frame is what gets stored and shown everywhere. One uniform shape → fair blind matchups, clean grids with no reflow, and stable framing for future features. The untouched original stays local as the private archive copy. Not "editing" (still no filters/adjustments) — a fixed frame is a fairness constraint, like the camera-only rule.
- **Offline-first pipeline (PRIORITY #1):** capture saved locally instantly with timestamp → retry queue with backoff → **capture time counts, not upload time** (11:58pm shot syncing 7am = valid, lands inside the voting window naturally). Thumbnail (300px) uploads first, full-res (1080px long edge, q0.7, ~150–250KB) follows. UI: "Shot saved ✓ — uploading," never a failable spinner.
- No AI-generated imagery (stated in guidelines; camera-only rule enforces most of it).

## 5. Visibility Hierarchy

**Archive** (private, unlimited) → **Showcase** (public wall on profile, promote ≤3/week, post-MVP) → **Daily Gallery** (public stage, earned, top ~20%) → **Photo of the Day** (crowned).

- Showcase: pull-based only (profile + Following tab). No global feed of showcases, ever. Full NSFW gate applies.
- **Collections** (post-MVP): named sets ("Japan 2027") shareable via link — travel-journal itch as portfolio, not feed.
- Traveler pitch: the game rewards novel scenery; the archive builds the trip diary automatically; Showcase carries the best shots. Never build stories/location feeds/broadcast.

## 6. Curating (Voting)

- Blind head-to-head pairs: **no username, level, or frame visible.** Anonymous forever.
- Open to everyone, anytime, no submission required (RLS fix from v1 — accept minor copy-inspiration risk).
- Served in **sets of 10 pairs**, natural stop after each set. Cap **50 picks/day**. Min **2s between votes** (server-checked). Future valve if demand: "Curator's Overtime," one extra set — a dial, never a floodgate.
- Picks are optional: skipping voting never touches streaks or entries. System needs *some* people voting across an ~18h window, never *you* at any hour.
- Your pick = winner's heart +1 (anonymous inside the count).

## 7. Ranking & PotD (hybrid — research-backed)

- **Live (all day):** incremental Elo (K=32, start 1000) per vote — 2-row transactional update. Jobs: matchmaking (pair similar strength) + live feel. 
- **Official (8am `close-day`):** **Bradley-Terry MLE** fit on the day's full vote table (MM algorithm, ~30 lines, sub-second at 1k photos). Order-independent → rank depends only on *who you beat*, never *when* → structural late-submitter fairness. Regularize with one virtual half-win/half-loss vs a dummy (handles undefeated/winless/disconnected).
- **Confidence shrink:** `score = μ + (bt − μ) × n/(n+C)`, C≈5 — flukes damped, proven photos stand.
- **Gallery:** top 20% by score, min 10 / max 50, `in_gallery = true`.
- **PotD:** highest score meeting quorum (≥8 comparisons; matchmaker priority-serves under-voted photos so quorum is normally met). Tie → more comparisons → higher raw win rate.
- **Only #1 is public.** No 2nd/3rd, no positions — numbers convert wins into losses. Private self-stats only ("your best finish"). Weekly opt-in leagues post-MVP.
- Low-vote failsafe: <5 comparisons/photo at close → priority-serve final hour or conservative prior; beta: <15 submissions → everyone makes gallery.
- PotD gets: gallery cover + gold border + 👑 (treatment lives on the photo/that gallery forever, incl. profile tile) + PotD badge/count + +100 XP + gold share card. **NOT an equippable frame** (protects cosmetic economy + blind voting).

## 8. Hearts & Reactions

- Display **hearts = votes won + signed reactions** (one warm number, grows forever). Data stays split: `vote_count` (feeds ranking, frozen at close) vs `reaction_count` (post-gallery, never re-ranks).
- Reactions: **single custom-drawn heart** (Piqa's own line-art icon, never the OS emoji glyph — avoids template/AI-generated look). 1/user/photo, anywhere the photo is public. Tap count → list shows signed reactors only. Notifications batched daily. `reactions.emoji` column kept for future custom-illustrated reaction packs (possible cosmetics); v1 writes only `'heart'`.

## 9. Social

- Profiles: username, avatar, level, title, frame, **gallery-wins wall only** (+ Showcase later), counts (galleries, streak, hearts). Non-gallery photos never public. Every profile is a highlight reel by construction.
- **Follow:** one-way, one tap, **counts hidden from everyone including the owner.** Gives a "Following" tab inside Gallery. No requests, no DMs.
- Squads (post-MVP): mutual, 3–5, shared streak, invite loop.
- Safety: username-only, no location, block hides you from them everywhere.

## 10. Retention, XP, Cosmetics

- **Streak:** weekly goal — play 4 of 7 days keeps the flame. 1 free shield/week auto-applied. Submission-based only (voting/winning don't touch it).
- **Comeback:** 2+ days lapsed → double-XP welcome, positive push only.
- **XP earn:** submit +20 · Quick Draw +10 · heart +2 · gallery +50 · PotD +100 · pick +1 (cap 30/day) · weekly goal +100. **Daily cap ~200–300 = no grind surface; progression measures consistency, not hours.**
- **Levels:** `next = 100 × level^1.5`, defined to Lv50 ("Legend"), no XP max. Level derived from `xp`, never stored.
- **Spend:** cosmetic unlocks only — frames, titles (Lv5 Shutterbug / Lv15 Eagle Eye / Lv30 Curator), Top Curator badge track, Lv10 bonus-shot slot. XP never buys votes, placement, or streak repair.
- **Frames = config, not art:** one `<PhotoFrame>` component + JSON array (color/gradient/width/corner). MVP: 5 frames, 3 titles.
- **Quiet-mode rendering:** XP/levels live on profile + done-screen tick only; no mid-flow popups. Test for every mechanic: *could a user ignore it completely and still have the full experience?*
- Haptics only (vote tick, submit buzz, gallery impact). **No sound effects.** Win moment: photo + Lottie confetti + haptic (Tier-3 text version fine for beta).

## 11. Navigation, Tabs & Empty States

> **Updated 2026-07-29** (post-MVP design review, not yet implemented): Studios is
> promoted from a backlog nested feature to a full tab, and Archive moves from a
> tab into a Profile section, to make room without exceeding the 3–5 tab research
> ceiling. Rationale, research citations (incl. Duolingo's own Feb 2026 tab
> redesign giving Friends/Leaderboard full tabs), and the corrected IA are in
> `docs/design-review/` (gitignored locally — see `docs/design-review-summary.md`
> for the tracked, in-repo synthesis). The rest of this section is the original
> MVP spec; treat the tab row below as superseded once Studios ships.

**Bottom nav: 4 tabs + raised center shutter** (research-backed: 3–5 items, thumb zone, icons+labels always, active state = 2+ modifications, 48px+ targets).

`Today · Gallery · [ ● shutter ] · Archive · Profile` — **MVP.** Post-Studios: `Today · Gallery · [ ● shutter ] · Studios · Profile`, with Archive relocated to a Profile section (reusing the existing Wins/Starred segmented-toggle pattern).

- **Icons: Lucide only** (`lucide-react-native`, ISC license — never mix families, no Flaticon/paid sets): `house`, `image`, `aperture` (shutter), `book-image` (archive — moves to a Profile row post-Studios), `users` (studios, post-MVP), `user`. Labels 11px Instrument Sans under every tab.
- **Center shutter = raised 60dp safelight circle with `aperture` icon** — the logo's dot made tappable, always opens the camera. It is also a status display:
  - **Shot live:** safelight fill + paper ring (pulse) → shoot now
  - **Submitted/done:** rests in ink2 with check → calm
  - **Default:** safelight, no ring → free shooting
- Active tab: safelight icon + medium-weight label (two modifications). Inactive: paper @40%.
- Badge dot on Today when something waits (drop live / gallery revealed). No badge counts, no nagging. Post-Studios: the same plain dot mechanic also lights on unread appreciation, and appears on the Studios tab for studio activity — never a count.
- Bar is ink `#141210`; photos above it stay the brightest element.
- Deliberate omissions: no Search tab (no feed to search), no Curate tab (curating lives inside Today). No notification-center tab, ever (see badge-dot rule above) — this still holds post-Studios.

Tab contents: **Today** (Shot status, curate sets, done-screen) · **Gallery** (today's = yesterday's reveal + immutable past galleries, date-paged, re-viewable forever) · **Archive** (private journal; MVP tab, Profile section post-Studios) · **Profile** · **Studios** (post-MVP: shared standing off the same global gallery — never a separate judged contest, never peer voting, never a daily friend ranking; management (create/invite/leave) one tap deeper inside the tab).

- Gallery tab is never empty: shows the latest closed gallery all day; zero-submission days show most recent gallery + "quiet day 🌙" card.
- Bottom of today's gallery = real end card → "View past galleries" / live-action shortcuts / tomorrow teaser. History browsing = finite albums (magazine back-issues), chronological, no algorithm.
- Done-for-today screen: gallery → archive → streak → teaser → close. Non-gallery submitters see "Your shot was picked N times by curators worldwide ❤️" — never a loss.

### 11b. Design System ("Darkroom")

- **Colors:** ink `#141210` (bg) · ink2 `#201D19` (cards) · paper `#F2EDE4` (text, never #FFF) · paper60 (secondary) · **safelight `#FF5A36`** (sole accent: actions, streak, live) · crown `#E3B341` (PotD only, once/day) · heart `#E6453C`. One accent per screen; no greens/dashboard colors.
- **Type:** Clash Display Semibold (display moments only, Fontshare free) · Instrument Sans (body/UI, Google Fonts) · IBM Plex Mono (ALL numbers: countdowns, hearts, EXIF, streak — camera-readout language). Scale: 34/24/17/15/13.
- **Signature motif: viewfinder brackets** — 2dp paper corner ticks around today's Shot card, capture preview, and PotD (gold, only gold brackets in app). Bracket snap-in = the "focus locked" submit moment. `<Brackets>` component.
- **Surfaces:** 12dp radius cards, **0 radius on photos** (prints, not bubbles), 20dp gutters, no gradients/glassmorphism. Dark-first single theme at MVP.
- **Motion: exactly three moments** — bracket snap (200ms), morning gallery FadeInUp stagger (60ms), win-confetti Lottie. Reduced-motion respected. Haptics only, no sound.
- **Reactions:** single custom-drawn heart icon (asymmetric, human) — never OS emoji glyphs in shipped UI (spec's emojis are notation only).
- **Voting screen = most disciplined screen:** two photos, no brackets (blind = frameless), thin divider, nothing else.
- **Logo kit** (piqa-logo-kit.zip): mark = 3 brackets + safelight dot as 4th corner. Dot always singular, never recolored (sole exception: crown gold on PotD share card). Clear space = one bracket-arm width.


### 11c. Content Per Tab (IA — final)

**📸 Today — state machine, no sub-tabs.** Streak flame + 4-of-7 week dots pinned in header always. States: pre-drop (yesterday's PotD + teaser + curate shortcut) · Shot live (prompt in Clash inside brackets + giant Shoot + mono countdown + Quick Draw timer) · submitted (bracket-framed shot, "In the running ✓", curate card) · done (hearts so far → streak → teaser). Curating = contextual card here → full-screen blind pairs (sets of 10, progress dots) → back. No notification center.

**🖼️ Gallery — the ONLY sub-tabs in the app: World · Following** (segmented). World: date + prompt → PotD full-width (gold brackets, crown, shooter in Clash) → unnumbered 2-col grid (0-radius, mono hearts) → end card (past galleries · live shortcuts · teaser). Past galleries behind end card + header calendar icon: date-paged, immutable. Photo tap → full-res + name + heart + EXIF strip (mono, location stripped) → profile. Following empty state = invitation.

**● Camera — a mode, not a tab.** Full-screen viewfinder, minimal chrome (flip/flash/shutter ring). Live Shot: prompt strip + "submit as Today's Shot?" toggle (ON during window). Bracket snap + haptic on capture. Retake/Use only. No filters/editing at MVP — no-edit = fairness feature, said in onboarding.

**📔 Archive — filter chips (not segments): All · Daily Shots · Starred.** Month-grouped grid, newest first; entries badged (bracket-mini / crown). Photo actions: ⭐ Star (5/mo counter shown here — anti-ransom messaging lives here), Showcase (post-MVP), delete. Header: shot count + "since {month}". Empty = "Your journal starts with one shot" + shutter CTA.

**👤 Profile — same layout own/others.** Avatar+frame → username · title · level (mono) → stat strip (mono: galleries · streak weeks · hearts, no comparisons) → **wins wall (hero, most space)** → (Showcase post-MVP). Own: gear → sheet (cosmetics, region, guidelines, delete account, sign out). Others: Follow + ⋯ (report/block).

**Cross-tab laws:** sub-tabs in exactly one place · every empty state = invitation with CTA · one hero per screen (most space = most important) · all numbers Plex Mono · contextual actions appear only when live. MVP ≈ 12 screens.

### 11d. Component System ("Darkroom Kit")

**Foundation:** one safelight-accent interactive element per screen · numbers always Plex Mono · photos 0 radius / UI 12 · 48dp targets, 20dp gutters · press = scale 0.97 + light haptic (no ripples) · no pulses/glows/gradients.

**Atoms:** Button (Primary safelight pill 52dp — max one/screen; Ghost paper-border; Text paper60; loading = mono ellipsis, width locked) · Chip (selected = inverted paper/ink, not colored) · Mono/Countdown (tabular figures, ticking numbers ARE the motion) · StreakFlame (flame + mono count + 7 week-dots; no guilt state — dead streak = unfilled flame) · HeartButton (custom asymmetric heart, outline→#E6453C fill, 1.1 spring + haptic, no +1 floats) · Avatar (ink2 fallback, mono initials, frame = ring).

**Molecules:** `<Brackets>` (props color/gap/animated; ON: live Shot card, capture preview, submitted photo, PotD-gold; NEVER: voting pairs, plain tiles) · PhotoTile (0-radius, corner badge, mono hearts; skeleton = ink2, no shimmer) · ShotCard (ink2 + brackets + Clash 24 prompt + countdown + Primary — deliberately the loudest composition) · MatchupPair (two stacked tiles, 0.5dp divider, tap-photo-to-pick, paper flash + haptic, next slides 150ms; 10 progress dots + mono 7/10; no names/hearts; skip = small text) · GalleryGrid (2-col 8dp, PotD full-width first; stagger on first reveal only) · Sheet (ink2, 24 top radius — ALL secondary flows are sheets, never screens) · Toast (single-line ink2 pill above nav, 2s, past-tense fact, never stacks) · EmptyState (Lucide 32 paper60 + invitation line + Ghost CTA — name the action, never the absence).

**Moments (all four; nothing else animates):** 1. Focus-lock submit — brackets snap corner-by-corner 200ms + medium haptic + "In the running ✓" (the tactile signature). 2. Morning reveal — tile stagger; own gallery tile enters last with gold brackets + confetti Lottie (skippable, reduced-motion respected). 3. Shutter nav states (live/done/default). 4. Streak 4th-dot spring.

**States matrix (every component):** default · pressed · disabled (paper30) · loading · **offline first-class** — PhotoTile "queued ↻" badge, ShotCard button "Saved — will upload", nothing errors for lack of signal.

**File shape:** `components/{tokens.ts, atoms/, molecules/, moments/}` + `/dev/kit` demo screen built FIRST so later screens are assembly, not invention.

### 11e. Stack Decisions (final)

- **TypeScript, strict mode** — Expo default; Supabase codegen (`supabase gen types typescript`) types Postgres→screen; better Claude Code guardrails; portfolio requirement. `as`/`@ts-expect-error` allowed in MVP — shipping beats perfect types.
- **Scaffold: `npx create-expo-app@latest piqa` default template** (TS + Expo Router file-based tabs) → run `npm run reset-project` → lay in: `app/(tabs)/{_layout,today,gallery,archive,profile}.tsx`, `app/camera.tsx` (modal), `app/photo/[id].tsx`, `components/`, `lib/{supabase,types}.ts`. No community templates (their opinions fight ours).
- **Icons: Lucide** (`lucide-react-native`, ISC) — house · image · aperture (shutter) · book-image · user; strokeWidth 2.25 for warmth; +3 custom identity SVGs (asymmetric heart, flame, crown) matching stroke weight. One family everywhere; review on-device Week 2 before considering Phosphor.
- **Dependencies (only these at start):** supabase-js, expo-camera, expo-image-manipulator, expo-notifications, expo-haptics, lucide-react-native, lottie-react-native. Nothing speculative.

## 12. Moderation & Safety (launch requirements)

- NSFWJS on-device pre-upload scan (free) → quarantine flagged.
- **Report system:** ⋯/long-press on any public photo → one-tap reason (Nudity / Violence-gore / Harassment-hate / Not a real photo (AI-stolen) / Other) → photo instantly hidden from the reporter. **Auto-quarantine at 3 distinct-user reports** (pulled from voting/gallery pending review). Internal review queue (Supabase table view at MVP): approve / remove+strike / CSAM→instant ban+NCMEC. Reporters never see outcomes; serial false reporters silently down-weighted. `reports` gains `status` (pending/actioned/dismissed). + Block user. Nightly ~10-min review pass. Satisfies Play UGC checklist.
- Strikes: removal+warning → 7-day submit ban → account ban. CSAM: instant ban + NCMEC report.
- Age gate (birthdate), Teen rating, community guidelines page (no nudity, gore, harassment, AI images).
- **Account deletion (Play-required):** in-app Settings → Delete Account → confirm → Edge Function: purge storage objects, anonymize votes/reactions (keep rows for ranking integrity, null user refs), delete profile + auth user; grace-period email optional. Data Safety form must match.

## 13. Schema (Supabase Postgres)

`profiles`(id, username, avatar_url, timezone, region, is_premium, **xp**, created_at) · `prompts`(text, category, is_sponsored, used_at) · `prompt_drops`(prompt_id, region, drop_date, drops_at, **submit_closes_at, voting_closes_at**, status; uq region+date) · `submissions`(drop_id, user_id, image_path, thumb_path, **captured_at**, rating[1000], **bt_score**, vote_count, **reaction_count**, quick_draw, in_gallery, **is_potd**; uq drop+user) · `votes`(drop_id, voter_id, winner_id, loser_id; uq voter+pair) · `streaks`(current_weeks, days_this_week, shields, last_active) · `reactions`(user_id, submission_id, emoji; PK user+sub) · `follows`(follower_id, followee_id) · `reports`(user_id, submission_id, reason) · **`free_shots`**(user_id, image_path, thumb_path, captured_at, is_showcased, starred) · `config`(key, value) — **all thresholds (gallery %, caps, quorum, windows) are config rows, tunable without deploy.**

RLS: own-row inserts everywhere · **votes open to all authed users** (v1 anti-copy rule removed) · gallery photos public, non-gallery owner-only · no self-vote (trigger) · free_shots owner-only unless showcased.

Storage: buckets `submissions` (private, signed URLs), `avatars` (public). Path `submissions/{drop_id}/{user_id}.jpg`. Retention: gallery = full-res forever · non-gallery → thumb-only after 30 days (free tier) · premium keeps all · **5 free "stars"/month keep any shot full-res** (anti-ransom). Weekly cleanup cron.

## 14. Serving Architecture

- **`get-matchup` RPC:** returns 10 pairs/call — exclude own + already-judged, order by vote_count ASC (exposure floor) with randomness, prefer close Elo, pre-signed thumb URLs in payload. Client prefetches next set during judging.
- **Vote RPC:** insert + both Elo updates + counters in one transaction; optimistic UI, async fire, retry.
- **`close-day` (8am cron):** BT fit → shrink → gallery/PotD flags → streaks/XP → **materialize gallery as one static JSON blob** (IDs, signed thumbs, names, hearts) → queue 9am pushes. Morning rush reads cached blob: zero DB queries/view. Past galleries immutable → cache forever.
- **`drop-prompt` (00:05 UTC cron):** create per-region drops with random drops_at; **push fan-out jittered 10–15 min** (BeReal thundering-herd fix); pre-warm drop endpoint.
- One screen = one RPC (`get_home_state()` returns drop status + submission + streak + unvoted count).
- Indexes: `submissions(drop_id, vote_count)` · `votes(voter_id, drop_id)` · partial `submissions(drop_id) WHERE in_gallery`.
- Reactions: poll visible photos / Realtime only on the open photo. Full-res lazy on tap.
- App must fully work when opened WITHOUT the push (Xiaomi/Oppo/Vivo kill notifications): Today tab always shows current state; autostart prompt for those OEMs; high-priority FCM.

## 15. Tech Stack

Expo RN (camera, notifications, image-manipulator, haptics, lottie) · Supabase (Postgres, Auth, Storage+CDN, Edge Functions, pg_cron) · Expo Push→FCM · NSFWJS · RevenueCat later · Vercel landing · PostHog free.

## 16. Beta Mode (2–15 users)

Single region, drop at known-good 7–8pm (not random) · gallery = all submitters (<15 subs) · Elo-skip → hearts if <2 voters · late-submit grace unlimited · **seed 3–4 house accounts submitting daily** (retire with growth) · zero-day fallback card · Play's 12-tester/14-day closed test = the beta itself; recruit testers Week 1 · test on ₱5–7k Android.

## 17. Monetization (post-retention only)

Consumables (shields, retake, Quick Draw pass ₱15–50) · cosmetics (₱30–150) · premium ~$2.99 (full-res archive, stats, 2 shields/mo, bonus shot, vote-priority-for-exposure NO — vote-priority means *entering matchups sooner*, never winning them) · **sponsored Shots** at 50k+ DAU: sells participation + UGC library + share spillover, priced per submission not per view; max 1/week, labeled 🤝, shootable without purchase, normal gallery rules. Never: ads, paid votes, paid placement. USD pricing globally.

## 18. Competitive Position

- **ThemeSnap** (direct competitor, new): same daily-global-theme premise but with live feed + likes/comments + leaderboards + follower-building → popularity contest + IG anxiety. Piqa wins on blind fairness, positivity, sun-following regional clock (they drop at one global midnight), offline-first, finiteness. **Action: install it, play 5 days during Week 1, note flaws, check installs.**
- **GuruShots:** pay-to-win collapse (1.6★) — the cautionary tale; our fairness laws are its inverted autopsy.
- **PhotoQuest:** solo practice, no community — steal its skill-building framing.
- **BeReal:** dead premise (unprompted life is boring; punished lapsed users; feature-not-platform). Steal EXIF display idea from ThemeSnap (strip location).

## 19. Costs (Year 1)

Google Play $25 · joinpiqa.com $11.28/yr · everything else free tier ≈ **~₱2,100 total**. Deferred: Apple $99/yr, IPOPHL ₱2,400, Supabase Pro $25/mo.

## 20. Build Plan (4–6 weeks part-time)

| Wk | Deliverable |
|---|---|
| 1 | Supabase + schema + auth · Expo skeleton · **in-app camera + offline queue** · buy domain/handles · recruit 12 testers · install ThemeSnap |
| 2 | drop-prompt cron + jittered push + submission E2E · free shooting → archive |
| 3 | get-matchup sets + vote RPC + Elo · close-day: BT fit + gallery JSON + morning push |
| 4 | Streaks, XP quiet-mode, profiles+follow, reactions, NSFWJS, report/block, **account deletion** |
| 5–6 | Closed test 14 days · fix · 60 prompts written · privacy/ToS · store listing + Data Safety · submit |

## 21. Post-MVP Backlog (priority)

1. Showcase (3/wk) 2. Judge→Curator polish + Top Curator 3. Squads 4. Collections 5. Weekly opt-in leagues 6. Dual lanes (📸/😂) 7. Anti-bot hardening 8. Region splits at ~1k subs/region 9. iOS 10. Curator's Overtime dial 11. Comments (creator-opt-in, if ever).

---

*Every remaining unknown is answered by shipping, not designing.*
