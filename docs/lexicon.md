# Piqa — Lexicon (canonical vocabulary)

*Draft · Jul 2026 · the single source of truth for what every concept is CALLED in the UI. Locks brand voice across the major build. Extends Spec §1 ("Today's Shot," Curators, "pick"). Vocabulary lives in photography's world — Shot, Camera, Gallery, Curator, Archive, Showcase.*

---

## The rule on "prompt"

**Never use "prompt" in any user-facing string.** In 2026 the word reads as *AI text generation* — which directly undermines Piqa's camera-only, **no-AI-imagery** positioning (§4). This is brand defense, not preference.

- **User-facing:** **"Today's Shot"** / "the Shot" / "today's subject."
- **In new code + docs, refer to the concept as the "Subject"** (what a photographer shoots — photography-native, zero AI baggage, and distinct from the photo *entry*).
- **Align the tables too — rename `prompts` → `subjects`, `prompt_drops` → `subject_drops` (Phase 0B).** A code↔product mismatch on the *core* concept is confusing forever, and alpha is the cheapest time to fix it. Do it once as an isolated migration before any feature work; see `build-steps.md` §0B. (This reverses the earlier "leave the schema" call — deliberately, because the concept is central and the DB is still tiny.)
- **Derived names must follow:** "Golden Prompt" → **"Golden Shot"**; "prompt library" → **"the Subject library"** (internal) / never shown to users.

---

## Canonical map

Legend: ✅ say this · 🔧 internal/code · 🚫 never say (and why)

| Concept | ✅ User-facing | 🔧 Internal / code | 🚫 Never say |
|---|---|---|---|
| The daily theme | **Today's Shot** / the Shot | `subjects`, `subject_drops` | prompt (AI), quest |
| The theme, spoken | **Subject** — always framed ("Today's subject: …"), never a bare label | `subjects` | prompt, a lone "Subject" tab |
| Entering your photo | **enter** · "**Locked in**" | `submissions` | post, upload, in the running |
| Your entered photo | **Shot** / entry | `submissions` | pic, post |
| A person using Piqa | **Photographer** · "you" | `profiles` | shooter (violent read), user, creator |
| Voting (verb) | **pick** | vote | judge, rate, like |
| A voter | **Curator** | voter | judge, juror |
| The blind pair | **matchup** / two shots | `matchup` | battle, versus |
| Winning photo | **Photo of the Day (PotD)** | `is_potd` | winner-badge |
| Reaching the daily gallery | **made the Gallery** | `in_gallery` | featured |
| The daily reveal | **the Reveal** / "morning paper" | reveal | drop-results |
| Appreciation on a photo | **heart** | `reactions` | like (IG connotation) |
| Craft recognition *(new)* | **Nods** (Curator taps a preset craft tag) | `nods` | kudos, comment, review, like |
| Private photo journal | **Archive** | `free_shots` / archive | camera roll, feed |
| Public best-shots wall *(later)* | **Showcase** | showcase | feed, grid, profile posts |
| Keeping a shot full-res | **Star** | `starred` | save, favorite |
| Retention flame | **Streak** | `streaks` | combo |
| Progression | **Level** / **XP** | `xp` | points, **coins**, gems |
| Cosmetic photo border | **Frame** | `frames` | skin, filter |
| Friend group *(new)* | **Studio** | `studios` | squad, team, clan, guild |
| Studio creator *(new)* | **Director** | `studios.director_id` | captain, admin, owner |
| Studio member *(new)* | **studio member** / the Studio | `studio_members` | — |
| Premium tier | **Piqa Pro** | `is_premium` | VIP, Gold |
| Quick submit bonus | **Quick Draw** | `quick_draw` | speed bonus |

---

## Voice rules (so new strings stay on-brand)

- **Photography vernacular first** — Shot, Curator, Gallery, Frame, Archive, Reveal. If a word could belong to Instagram or a mobile game (like, post, coins, VIP, guild), it's wrong.
- **Past-tense fact, never a demand** — "Locked in ✓," "Picked 12 times," "Curators nodded: Great light," not "Vote now!" (Law 7: urgency is a reward, not a punishment).
- **No loss language** — never "you lost," "rank #4," "you're behind." Reflect wins and effort only (Law 3).
- **Numbers are camera-readout** — always mono, factual ("240 hearts," "day 011").
- **"Pick," not "judge"** — Curators appreciate; they don't sit in judgment.

---

## Locked
User = **Photographer** ("you" in-app) · daily theme = **Subject** (context-framed) · entry status = **Locked in** · friend group = **Studio** · studio creator = **Director** · members = **the Studio / studio member** · craft recognition = **Nods** (shown as "Curators nodded: Great light ×38"). Together: *a **Studio** of **Photographers**, run by a **Director**, shooting the daily **Subject**.*

## Open naming decisions
- Whether to soften "Photo of the Day" to a shorter spoken form ("the Crown"?) in casual UI.
- Event names once the events calendar exists (Golden Shot + seasonal themes).

*When in doubt, ask: would a photographer say it, or would an app say it? Say what the photographer would.*
