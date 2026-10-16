/**
 * Pure geometry for the v2 hand-built charts (docs/design-system-v2.md#charts). Every helper
 * works in plain numbers so the components stay presentational and the maths is unit-tested.
 */

/** The smallest "nice" ceiling (1, 2, 2.5 or 5 × 10ⁿ) at or above `value`; 1 for empty data. */
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= value);
  return step * power;
}

/**
 * `[x, y]` points across `width` × `height` for values scaled to `max` (y grows downward).
 * Each point sits at the centre of its equal column, so HTML labels in a grid line up below.
 */
export function seriesPoints(values, max, width, height) {
  const top = max > 0 ? max : 1;
  const span = values.length ? width / values.length : 0;
  return values.map((value, index) => [
    round((index + 0.5) * span),
    round(height - (Math.max(0, value) / top) * height),
  ]);
}

const round = (value) => Math.round(value * 100) / 100;

/** An SVG path through the points. */
export const linePath = (points) =>
  points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');

/** The closed area under the points down to `baseline`. */
export function areaPath(points, baseline) {
  if (!points.length) return '';
  const first = points[0];
  const last = points.at(-1);
  return `${linePath(points)} L${last[0]} ${baseline} L${first[0]} ${baseline} Z`;
}

/**
 * Whole-number percentages for each value that always total 100 when anything is present
 * (largest remainder), so stacked bars and their tables agree.
 */
export function shares(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!total) return values.map(() => 0);
  const exact = values.map((value) => (Math.max(0, value) / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => [value - floors[index], index])
    .sort((a, b) => b[0] - a[0]);
  for (const [, index] of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Ring segments as stroke dashes on a circle of `circumference`: `{ length, offset }` per
 * value, starting at the top, with `gap` units of surface between non-zero segments.
 */
export function ringDashes(values, circumference, gap = 0) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const present = values.filter((value) => value > 0).length;
  const room = circumference - (present > 1 ? gap * present : 0);
  let start = 0;
  return values.map((value) => {
    const length = total ? (Math.max(0, value) / total) * room : 0;
    const dash = { length: round(length), offset: start ? round(-start) : 0 };
    if (length > 0) start += length + (present > 1 ? gap : 0);
    return dash;
  });
}

/** Whole percentage of `value` against a positive `target`, or null without one. */
export const percentOf = (value, target) =>
  target > 0 ? Math.round((Math.max(0, value) / target) * 100) : null;
