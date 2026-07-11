import { colors } from "@/components/tokens";

/**
 * Cosmetics are DATA, not art (spec §10): one renderer + a JSON array. Frames
 * and titles unlock by level and are applied automatically (highest unlocked).
 * A manual equip sheet can come later; nothing here buys placement or votes.
 *
 * Crown gold is deliberately absent — it is reserved for PotD only (spec §11b),
 * so no frame can imitate the crown treatment.
 */

export type Frame = {
  id: string;
  label: string;
  unlockLevel: number;
  /** null = no ring (the base look everyone starts with). */
  color: string | null;
  width: number;
};

// MVP: 5 frames (base + 4 earned). Unlock levels form a reachable early ladder
// (day 1 → ~6 weeks) so frame progression is actually visible — the 100×level^1.5
// curve makes Lv15+ take months at the daily XP cap. Titles stay at the spec's
// Lv5/15/30 (long-term prestige); frames deliberately unlock sooner.
export const FRAMES: Frame[] = [
  { id: "base", label: "Base", unlockLevel: 1, color: null, width: 0 },
  { id: "paper", label: "Paper", unlockLevel: 2, color: colors.paper40, width: 2 },
  { id: "safelight", label: "Safelight", unlockLevel: 4, color: colors.safelight, width: 2 },
  { id: "ember", label: "Ember", unlockLevel: 6, color: colors.safelight, width: 3 },
  { id: "print", label: "Print", unlockLevel: 9, color: colors.paper, width: 3 },
];

/** The best frame a given level has earned. */
export function frameForLevel(level: number): Frame {
  let earned = FRAMES[0];
  for (const f of FRAMES) if (level >= f.unlockLevel) earned = f;
  return earned;
}

export type Title = { label: string; unlockLevel: number };

// MVP: 3 earned titles over a base (spec §10: Lv5 / Lv15 / Lv30).
export const TITLES: Title[] = [
  { label: "Shooter", unlockLevel: 1 },
  { label: "Shutterbug", unlockLevel: 5 },
  { label: "Eagle Eye", unlockLevel: 15 },
  { label: "Curator", unlockLevel: 30 },
];

/** The best title a given level has earned. */
export function titleForLevel(level: number): string {
  let earned = TITLES[0].label;
  for (const t of TITLES) if (level >= t.unlockLevel) earned = t.label;
  return earned;
}
