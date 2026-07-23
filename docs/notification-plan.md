# Notifications — the calm plan

*How Piqa notifies without becoming the thing that annoyed everyone about BeReal /
Duolingo / IG. Grounded in the laws: positivity-only (Law 3), anti-anxiety/calm,
**no sound ever** (§11b), **daily-batched** reactions (§8), **no notification
center** (§11).*

---

## Why notifications annoy — and the rule for each

Annoyance has five sources. The whole plan is just: neutralize all five.

| Source of annoyance | Piqa's rule |
|---|---|
| **Volume** (too many) | Bias to fewer. Batch the frequent, cap the day at ~2–3 for a typical user. |
| **Irrelevance** (don't care) | Personal > broadcast. Every push must be worth the interruption. |
| **Manipulation** (FOMO / guilt / streak-shame) | **Never.** No "don't miss out," no "your flame dies in 1h," no re-engagement nags. This is the big one — and it's already the law. |
| **Bad timing** (3am buzz) | Quiet hours + the user's timezone. Silent always (no sound). |
| **No control** | Simple per-category toggles + a quiet-hours window. Off is one tap. |

**North star:** a push is a *gift*, not a *hook*. If it wouldn't make the user
glad we sent it, we don't.

---

## The taxonomy — 5 user-facing categories

Grouped so the Settings screen has 5 switches, not 12. Defaults chosen so the
out-of-box experience is valuable-but-quiet.

| # | Category | What fires | Default | Frequency | Timing |
|---|---|---|---|---|---|
| 1 | **Daily Subject** | "Today's Subject is live: *Something red*" | ON | 1×/day | at drop (06:00 local), **jittered 10–15 min** to avoid the herd-refresh spike (§8) |
| 2 | **Results** | "The gallery's up — see how today went" | ON | 1×/day | at reveal |
| 3 | **Your photo did well** | PotD crown · made the gallery · Top 10 | ON | rare | at reveal (bundled) |
| 4 | **Appreciation** | "14 curators loved your shot today" (hearts **+** nods) | ON | **1×/day, BATCHED** | at reveal / end of day — **never per-heart** (§8) |
| 5 | **Social** | new follower · someone you follow was crowned | ON | low | immediate (rare enough) |

*(Future: **Studios** becomes category 6 when it ships — friend-group activity,
default ON.)*

**Deliberately NOT built:** re-engagement / "we miss you" / streak-risk nags. These
are the #1 annoyance and violate Law 3 + the anti-anxiety stance. A disengaged user
gets **less**, never a guilt-trip. (If we ever test one, it's a single, gentle,
opt-in, positive social-proof line — "your Studio shot today" — never "you're about
to lose your streak.")

### A typical engaged day = ~2 pushes
- **Morning:** Daily Subject (1).
- **Evening:** one reveal push that *bundles* results + your placement + the
  appreciation count (1, occasionally 2 if you were crowned).
- Reactions/nods **never** ping individually — they roll into the evening number.

That's the entire point: high-signal, low-count, no dead-of-night, no manipulation.

---

## Controls (Settings → Notifications)

One screen, no notification center (§11):
- **Master** — all on/off (also reflects the OS-level permission state).
- **5 category toggles** (above).
- **Quiet hours** — a start/end window, default **21:00 → 08:00 local**. Nothing
  sends inside it; anything that would has already passed (the drop is 06:00, reveal
  is evening), so in practice quiet hours just guarantee no overnight surprise.

That's it. No frequency sliders, no digests-config — the batching decisions are made
*for* the user so the screen stays calm too.

---

## Copy & tone (this is half the battle)

- **Warm, specific, positive.** Name the Subject: "Today's Subject: *Something red* 📷"
  beats "New challenge!"
- **Never** exclamation-urgency, FOMO, or guilt. "14 curators loved your shot" —
  not "see who you're missing."
- **Losses never surface** (Law 3): we notify wins and appreciation; we never ping
  "you didn't place."
- Silent, always (§11b).

---

## Server mechanics

- **Prefs storage:** add per-user prefs — either columns on `profiles`
  (`notif_daily`, `notif_results`, `notif_wins`, `notif_appreciation`,
  `notif_social` booleans + `quiet_start` / `quiet_end` time) or a small
  `notification_prefs` table. Reuse the existing `profiles.timezone`.
- **`send_push` becomes preference-aware:** before sending to a recipient, check
  their category flag AND whether *their local* now is inside quiet hours; skip if
  either fails. For region broadcasts (Daily Subject / Results) resolve recipients
  filtering on the flag + quiet window instead of blasting the region.
- **Batching:** the Appreciation push is computed at reveal — one aggregate per
  photographer ("N loved your shot today"), not the per-`reactions`-insert path.
  Do NOT wire a per-heart trigger.
- **Jitter:** stagger the Daily Subject fan-out over 10–15 min (a per-user offset)
  so the whole region doesn't refresh at the same second (§8, the BeReal herd fix).
- **Idempotency + cap:** each event notifies once (already have the drop flags);
  the batching naturally caps a normal day at ~2–3.

---

## Build phasing (all OTA-class — no setup, no build)

- **Phase A (do first):** the 5 category toggles + quiet hours in Settings;
  `send_push` honors prefs + quiet hours; **batch Appreciation into the reveal
  push**; add **made-the-gallery** to "Your photo did well." This is the whole
  user-facing win.
- **Phase B:** per-user drop **jitter**; precise timezone-correct quiet windows.
- **Phase C:** Studios notifications (when Studios ships).

---

## The one-line summary

**Fewer, personal, positive, well-timed, and controllable.** Batch the frequent,
isolate the rare, never manipulate, respect the clock — and give one calm screen to
turn any of it off. That is how notifications *help* retention instead of burning it.
