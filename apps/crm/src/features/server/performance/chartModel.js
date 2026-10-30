/**
 * Presentation helpers for the Performance chart: a rounded axis maximum, short axis labels and
 * month names. Nothing here changes a figure; values arrive already calculated.
 */
const steps = [1, 2, 4, 6, 8, 10];
const compact = new Intl.NumberFormat('en-AE', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * The smallest "nice" axis maximum at or above `max` (and `floor`); half of it is always a whole
 * number. Fees use an AED 1,000 floor so an empty year still has a readable scale.
 */
export function niceMax(max, floor = 2) {
  const value = Math.max(floor, max > 0 ? max : 0);
  const scale = 10 ** Math.floor(Math.log10(value));
  const step = steps.find((candidate) => candidate * scale >= value) ?? 10;
  return step * scale;
}

export const axisFloor = (metric) => (metric === 'fees' ? 100_000 : 2);

/** Short axis text: fees are fils shown as compact AED, counts as compact numbers. */
export const axisLabel = (metric, value) =>
  metric === 'fees' ? `AED ${compact.format(value / 100)}` : compact.format(value);

const monthDate = (month) => new Date(`${month}-01T12:00:00`);

export const shortMonth = (month) =>
  monthDate(month).toLocaleDateString('en-AE', { month: 'short' });

export const longMonth = (month) =>
  monthDate(month).toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

/** Bar height as a percentage of the axis, keeping a visible sliver for non-zero values. */
export function barHeight(value, axisMax) {
  if (!value) return 0;
  return Math.max(2, Math.min(100, (value / axisMax) * 100));
}

/** Goal status for the KPI chip: met, in progress, no target, or hidden from this caller. */
export function goalStatus({ percent, target, hidden, pending }) {
  if (pending) return null;
  if (hidden) return { tone: 'muted', icon: 'lock', label: 'Private' };
  if (percent === null) return { tone: 'muted', icon: 'target', label: 'No target' };
  if (percent >= 100) return { tone: 'good', icon: 'check', label: 'Target met' };
  return target ? { tone: 'progress', icon: 'trend', label: 'In progress' } : null;
}
