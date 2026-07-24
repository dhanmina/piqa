/**
 * Level from XP — spec §10: `next = 100 × level^1.5`, defined to Lv50 ("Legend").
 * Level is always DERIVED from xp, never stored. `next(n)` is the XP needed to
 * go from level n to n+1; a level's threshold is the running sum.
 */
const MAX_LEVEL = 50;

export type LevelProgress = {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level costs to clear (0 at max level). */
  toNext: number;
  atMax: boolean;
};

/**
 * Level + progress into it, both derived from xp (never stored). `into/toNext`
 * feed the quiet Profile progress bar — the only place, with the morning
 * reveal, that XP is ever shown (spec §10 quiet mode).
 */
export function levelProgress(xp: number): LevelProgress {
  let level = 1;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    const toNext = Math.round(100 * Math.pow(level, 1.5));
    if (cumulative + toNext > xp) {
      return { level, into: xp - cumulative, toNext, atMax: false };
    }
    cumulative += toNext;
    level += 1;
  }
  return { level: MAX_LEVEL, into: 0, toNext: 0, atMax: true };
}

export function levelFromXp(xp: number): number {
  return levelProgress(xp).level;
}
