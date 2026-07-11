/**
 * Level from XP — spec §10: `next = 100 × level^1.5`, defined to Lv50 ("Legend").
 * Level is always DERIVED from xp, never stored. `next(n)` is the XP needed to
 * go from level n to n+1; a level's threshold is the running sum.
 */
const MAX_LEVEL = 50;

export function levelFromXp(xp: number): number {
  let level = 1;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    const toNext = Math.round(100 * Math.pow(level, 1.5));
    if (cumulative + toNext > xp) break;
    cumulative += toNext;
    level += 1;
  }
  return level;
}
