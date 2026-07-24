/**
 * Formatting helpers for count + noun prose.
 *
 * `plural` picks the noun form so a count never reads "1 hearts". 1 is singular;
 * everything else — including 0 — is plural ("0 hearts", "2 hearts"). Irregular
 * plurals pass their own second form: plural(n, 'person', 'people').
 *
 * Usage: `${count} ${plural(count, 'heart')}` → "1 heart" / "5 hearts".
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
