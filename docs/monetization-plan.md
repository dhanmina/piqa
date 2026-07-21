# Piqa — Monetization Plan

*Draft · Jul 2026 · builds on Spec v3 §0, §13, §17. Monetization is **post-retention** — this is the plan to execute once D7/D30 hold, not a launch task.*

---

## 0. The governing constraint

Piqa is **freemium by law, not by choice.** A hard paywall converts ~5× better (industry median D35 trial→paid 10.7% vs 2.1% freemium) but is disqualified by Design Law 1 (Fairness) and the "could a user ignore this mechanic and still have the full experience?" test.

**The firewall:** money may only buy things the **blind vote cannot see**. Nothing sold may change an *outcome* (gallery cut, PotD) or *exposure*.

---

## 1. What is sellable — and what would poison the app

| ✅ Fair game (invisible to the vote) | ✗ Never (the GuruShots 1.6★ line) |
|---|---|
| Cosmetic frames, rings & reaction packs | Paid votes / votes-for-sale |
| Full-res archive retention (Pro) | Paid gallery placement or PotD |
| Private stats / "best finish" history | **Exposure or vote-priority** (see §3) |
| Share-card / export styles | Hard paywall on shooting/judging |
| Clean consumables: shields, archive top-ups | Ads |
| — | Guilt / streak-repair purchases |

*Full SKU-by-SKU vetting — including the items that fail the gate — is in §3b.*

---

## 2. The model — "Piqa Pro" value ladder

All tiers sit on top of a **fully free core**. Each is a *bounded* release valve (Law 2).

- **Cosmetics — ₱30–150, one-time.** Frames, avatar rings, custom reaction packs, share-card styles. Safest revenue — blind voting can't see any of them. Config-not-art → catalog scales without releases. **Titles stay earned, not sold** (selling XP-gated status cheapens the progression economy).
- **Consumables — ₱15–30, impulse.** Extra shield, archive/star top-ups only. **Capped**, never a limit-remover. *(Retake, Quick Draw pass, and bonus shot are **cut** — they fail the fairness gate; see §3b.)*
- **Piqa Pro — ~$2.99/mo (+ discounted annual).** Full-res archive kept forever, private stats, 2 shields/mo, bonus shot. **Nothing that touches ranking** — that is the promise and the marketing line. Annual plan carries the LTV; long trials (17–32 days) convert best.

*Sponsored Shots (a B2B, per-submission line at scale) are intentionally **out of scope for now** — parked in §9.*

---

## 3. DECISION: cut "vote-priority for exposure" from Pro

§17 floats paid exposure-priority. **Remove it — there is no fair version.**

- The matchmaker already serves under-voted photos first (`get-matchup` orders `vote_count ASC`) and guarantees every photo reaches quorum. **Exposure is non-scarce by design.**
- So paid priority is either **placebo** (you already had the exposure) or **real** → more comparisons by the 8am close → via confidence shrink `score = μ + (bt−μ)·n/(n+C)`, higher `n` = less shrinkage = a structural edge on the gallery cut and PotD. That is pay-to-win with extra steps.
- Pro is *stronger* without it: **"Pro never touches your ranking, ever"** is the exact inverse of GuruShots.

---

## 3b. The payable catalog — vetted for fairness + margin

Every candidate SKU runs two gates. **(F) Fairness:** can the blind vote or the gallery/PotD outcome see it? If yes → redefine or cut. **(M) Margin:** recurring beats one-time; watch COGS. Verdicts: ✅ clean · ⚠️ redefine · ⛔ cut.

| SKU | Type | ~Price | Why someone pays | Fairness | Margin |
|---|---|---|---|---|---|
| **Piqa Pro** | Subscription | $2.99/mo · ~$19.99/yr | Keep full-res forever, stats, 2 shields/mo | ✅ additive | Recurring; COGS = storage (below) |
| Frame packs / avatar rings | Non-consumable | ₱60–150 | Profile identity | ✅ ring only — invisible in blind voting | ~100%, no COGS |
| Custom reaction packs | Non-consumable | ₱30–90 | Signed appreciation flair (post-gallery) | ✅ reactions never re-rank | ~100% |
| Share-card / export styles | Non-consumable | ₱30–90 | Prettier shares → organic growth | ✅ cosmetic export | ~100% + growth flywheel |
| Extra shield | Consumable | ₱15–30 | Protect the flame pre-emptively | ✅ streak ≠ outcome (frame as protection, not repair) | high |
| Archive top-up / extra stars | Consumable | ₱15–30 | Keep more of your *own* shots full-res | ✅ your own archive | high, minus storage |
| **Studio cosmetics** (badge / banner / name style) | Non-consumable | ₱60–150 | The **Director** buys, the **whole Studio** wears it | ✅ social cosmetic, invisible to the vote | ~100% + it's a gifting/flex growth loop |
| **Studio size unlock** | Pro perk / one-time | — | Studio larger than the free cap (~8) | ✅ bounded valve — never gates the core | recurring or one-time |
| **Studio stats / history** | In Pro | — | "Our studio over time" | ✅ additive | part of Pro |

**Studios principle — never paywall participation.** Creating, joining, and competing in a studio is **free for everyone**; gating it would throttle the invite-loop growth it exists to create and brush Law 3. Monetize the *flex and depth around it*, never the multiplayer core. Full studio spec: `feature-research.md` §4b.

### DECISION: cut — never sold (recorded so they don't creep back)

Three spec items fail the fairness gate the same way vote-priority did (§3). **All cut.**

- **Bonus shot ⛔.** Piqa's identity is *one shot a day*, and Law 5 says the stage is scarce. A paid **second competitive entry** doubles a paying user's odds at the gallery and PotD → pay-to-win. *(If a bonus shot ever returns, it must be non-competitive — a Showcase/practice slot that never enters the gallery.)*
- **Quick Draw pass ⛔.** XP is walled off from votes/placement/streak, but it still drives **levels and titles — visible status** on every profile. Selling XP sells status → pay-to-win on the social axis.
- **Retake token ⛔.** The free flow already lets you reshoot and promote any shot before midnight, so a paid retake is either **redundant** or, if it reaches past `submit_closes_at`, **unfair** (bought time).

### Margin reality — where the profit actually is

- **Cosmetics = highest margin** (~100%, config-not-art, no COGS) but one-time → they spike, they don't compound.
- **Piqa Pro = the compounding engine** (recurring LTV, long-trial conversion). Catch: its headline benefit — *keep full-res forever* — is also its **main cost**. Supabase storage grows per Pro user, forever. Price the **annual** plan against lifetime storage, not one month. (The 30-day thumb-drop for free users exists precisely to cap this COGS — see §7.)
- **Store cut ≈ 15%** (Play small-business, PH until ~2027) → net ~85% on everything.
- **Consumables = impulse cash**, but low-frequency and half the candidates fail fairness → a garnish, not a pillar.

**Profit ranking:** (1) Piqa Pro annual — compounds · (2) cosmetic frame/reaction/share packs — pure margin + growth loop · (3) clean consumables (shields, archive top-ups) — impulse. Everything else is cut or parked.

---

## 4. How users pay (plumbing)

**Hard rule:** in-app digital goods must use store billing — **no Stripe in-app**. Abstract it with **RevenueCat** (already named in §15; `profiles.is_premium` already exists).

| Path | Fee (sub-$1M) | Where / when | Piqa |
|---|---|---|---|
| Google Play Billing (standard) | 15% (small-biz tier) | Everywhere incl. PH, today | **Launch** |
| Play external billing / link-out | ~10%, no billing fee | US/UK/EEA now · **PH ~Sep 2027** | Future |
| Apple IAP | 15% (Small Business) | When iOS ships (post-MVP) | Deferred |
| Apple US external link | 0% today (in flux, under appeal) | US only | Watch |
| Stripe / web checkout | ~3% | Web (out-of-app) or physical only | Web tier |

**PH catch:** Google's Jun 30 2026 external-billing change hit US/UK/EEA first; the Philippines isn't in until ~Sep 30 2027. Launch on standard Play Billing at the **15%** small-business rate.

---

## 5. Entitlement architecture (future-proofing)

1. **Entitlements are server-side truth.** Features unlock on a RevenueCat *entitlement*, never a raw product ID. RevenueCat webhook → Supabase → set `is_premium` / owned frames. **Client never asserts its own premium status** — storage retention especially is enforced server-side.
2. **Products are config.** Prices/tiers/offers live in the RevenueCat dashboard + a `config`-style table → re-price or run promos with no app release (mirrors Piqa's "thresholds are config rows" philosophy).
3. **Keep a web-purchase path in reserve.** RevenueCat now spans web; a logged-in web checkout for Pro dodges the store cut and is how to harvest the external-billing opening when PH gets it (~2027) — same entitlement, cheaper rail.
4. **Runs in an EAS dev/prod build, not Expo Go** (already have EAS set up).

---

## 6. Paywall UX

- **Soft + contextual, never a launch gate** — matches the "quiet-mode, no mid-flow popups" law.
- Surface Pro at the moment value is obvious: the archive screen when an old shot is about to lose full-res, the cosmetics sheet, the stats view.
- Copy hierarchy: value headline → trial/risk-reversal → price broken to a small unit. Benefit-driven CTA ("Keep every shot"), not "Subscribe".

---

## 7. DECISION: defuse the archive-retention landmine

§13's rule — *non-gallery photos drop to thumbnail-only after 30 days unless premium* — brushes against Design Law 3 (Positivity): a user watching their own photos degrade unless they pay is loss-aversion on a disengaged user.

**Plan:** make full-res retention generous/cheap (long free window + plenty of stars), and sell **"never lose a shot"** as a warm Pro *hook*, not a countdown *stick*. Lead Pro on cosmetics + stats + convenience (purely additive).

---

## 8. Execution sequence (post-retention gate)

- [ ] **Gate:** D7/D30 retention holding + submissions/drop healthy. Do not start before this.
- [ ] **Phase A — Cosmetics only.** RevenueCat SDK in the EAS build; entitlement→`is_premium` webhook→Supabase; server-side check; frames/titles as non-consumable IAPs. Lowest risk, validates the whole pipeline.
- [ ] **Phase B — Piqa Pro subscription.** Monthly + annual, free trial; archive-retention + stats gated on entitlement (server-enforced); soft contextual paywall; PostHog funnel + first A/B.
- [ ] **Phase C — Consumables.** Shields/retake/Quick Draw pass, capped.
- [ ] **Ongoing:** re-price via config; a few paywall A/Bs per month once volume can read them.

---

## 9. Open decisions

- Local (PHP) vs USD pricing for Pro in a price-sensitive launch market (spec says USD global — revisit for PH).
- Exact free archive window + monthly star count after defusing §7.
- Whether cosmetics are the *only* thing ever sold to lapsed users (Law 3: lapsed users receive rewards, not asks).
- **Sponsored Shots — parked.** A B2B, per-submission line (max 1/week, labelled 🤝, shootable free, normal gallery rules) to revisit only at meaningful DAU. Out of the current plan.
