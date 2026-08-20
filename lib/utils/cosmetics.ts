import { colors } from "@/components/tokens";

/**
 * Cosmetics are DATA, not art (spec §10): one renderer + a JSON array. Rings and
 * titles unlock by level and are applied automatically (highest unlocked).
 * A manual equip sheet can come later; nothing here buys placement or votes.
 *
 * These are AVATAR RINGS, not photo frames. A photo frame is the 750x1000 print
 * overlay in FramedPhoto — a different thing entirely, earned a different way
 * (see lib/frames.ts). They used to share the word "frame", which made the two
 * systems impossible to talk about; the ring is the one that goes round a face.
 *
 * Crown gold is deliberately absent — it is reserved for PotD only (spec §11b),
 * so no ring can imitate the crown treatment.
 */

export type Ring = {
  id: string;
  label: string;
  unlockLevel: number;
  /** null = no ring (the base look everyone starts with). */
  color: string | null;
  width: number;
};

// MVP: 5 rings (base + 4 earned). Unlock levels form a reachable early ladder
// (day 1 → ~6 weeks) so ring progression is actually visible — the 100×level^1.5
// curve makes Lv15+ take months at the daily XP cap. Titles stay at the spec's
// Lv5/15/30 (long-term prestige); rings deliberately unlock sooner.
export const RINGS: Ring[] = [
  { id: "base", label: "Base", unlockLevel: 1, color: null, width: 0 },
  { id: "paper", label: "Paper", unlockLevel: 2, color: colors.paper40, width: 2 },
  { id: "safelight", label: "Safelight", unlockLevel: 4, color: colors.safelight, width: 2 },
  { id: "ember", label: "Ember", unlockLevel: 6, color: colors.safelight, width: 3 },
  { id: "print", label: "Print", unlockLevel: 9, color: colors.paper, width: 3 },
];

/** The best ring a given level has earned. */
export function ringForLevel(level: number): Ring {
  let earned = RINGS[0];
  for (const r of RINGS) if (level >= r.unlockLevel) earned = r;
  return earned;
}

/** Avatar-ring width for an equipped profile frame (a touch bolder than level rings). */
const FRAME_RING_WIDTH = 3;

/**
 * The ring an avatar wears: the equipped profile frame's accent if it has one, else
 * the level ring (the base). This is what makes an earned frame — the crown above all
 * — a persistent profile flex, not just a photo skin. Typed structurally so it needn't
 * import FrameDef.
 */
export function avatarRing(
  frame: { ringColor: string | null },
  level: number,
): { color: string | null; width: number } {
  if (frame.ringColor) return { color: frame.ringColor, width: FRAME_RING_WIDTH };
  const r = ringForLevel(level);
  return { color: r.color, width: r.width };
}

/** VIP badge art per tier -- base/dark/light feed the beveled diamond on
 *  FramedAvatar, base alone (as a border/text color) feeds the "VIP II" chip
 *  next to the username on Profile. Never gold (reserved for the PotD crown,
 *  same rule as RINGS above) and never sold directly -- automatic at
 *  lifetime cosmetic-spend thresholds. */
export type VipTierArt = { base: string; dark: string; light: string };
export const VIP_TIERS: Record<number, VipTierArt> = {
  1: { base: "#C7CDD6", dark: "#8F98A6", light: "#E8ECF2" },
  2: { base: "#3D8B8B", dark: "#2A6363", light: "#5FB3B3" },
  3: { base: "#9C6BC7", dark: "#6B4589", light: "#C79AE8" },
};

const VIP_NUMERALS = ["", "I", "II", "III"];

/** "VIP II" -- the legible signal (the avatar badge is too small to read on
 *  its own on a real phone; this chip is what actually communicates tier). */
export function vipLabel(tier: number): string {
  return `VIP ${VIP_NUMERALS[tier] ?? tier}`;
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
