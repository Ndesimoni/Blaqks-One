const range = (from, to) => Array.from({ length: to - from }, (_, index) => from + index);

/**
 * The page buttons to show, zero-based: every page up to seven, otherwise the first, the last
 * and three around the current one, with a gap marker wherever pages are skipped.
 */
export function pageNumbers(pages, current) {
  if (pages <= 7) return range(0, pages);
  const start = Math.min(Math.max(current - 1, 1), pages - 4);
  return [
    0,
    ...(start > 1 ? ['gap-start'] : []),
    ...range(start, start + 3),
    ...(start + 3 < pages - 1 ? ['gap-end'] : []),
    pages - 1,
  ];
}
