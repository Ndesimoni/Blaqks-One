/** Presentation helpers for insight bars; counts arrive already calculated by insightsModel. */

/** Whole percentage of `total`, 0 when there is nothing to divide. */
export const percentOf = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

/** Rows ranked by count (largest first); ties keep their configured order. */
export const ranked = (rows) =>
  rows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);

export const sumOf = (rows) => rows.reduce((sum, row) => sum + row.value, 0);
