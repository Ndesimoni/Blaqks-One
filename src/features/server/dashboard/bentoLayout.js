/**
 * Bento placement for the v2 Dashboard. Tiles keep their preferred column span unless the
 * next one would not fit the row; then the last tile in the row widens to close the gap, so
 * rows never end with an empty cell. The last row closes the same way.
 */
export function packBento(items, columns = 4) {
  const tiles = items.map((item) => ({ ...item, span: Math.min(item.span || 1, columns) }));
  let used = 0;
  let last = -1;
  tiles.forEach((tile, index) => {
    if (used + tile.span > columns) {
      if (last >= 0) tiles[last].span += columns - used;
      used = 0;
    }
    used += tile.span;
    last = index;
    if (used === columns) {
      used = 0;
      last = -1;
    }
  });
  if (used > 0 && last >= 0) tiles[last].span += columns - used;
  return tiles;
}

/** A 2 × 2 tile with up to two full-width (span 2) tiles stacked beside it. */
function pair(key, beside, width) {
  const tiles = beside.map((tile) => ({ ...tile, span: width, rows: beside.length === 1 ? 2 : 1 }));
  return [{ key, span: 2, rows: 2 }, ...tiles];
}

/**
 * The full layout. With a hero tile (2 × 2), the first four key figures fill the 2 × 2 space
 * beside it. With a `second` tile (the finance summary), the next two figures stack beside it
 * the same way; without spare figures it joins the sections. Everything else packs into rows
 * of four. Returns `{ key, span, rows }` in reading order.
 */
export function bentoLayout({ hero, second, figures, sections }) {
  const row = (tiles) => packBento(tiles).map((tile) => ({ ...tile, rows: 1 }));
  if (!hero) return row([...(second ? [{ key: second, span: 2 }] : []), ...figures, ...sections]);
  const beside = figures.slice(0, 4);
  const lead = [
    { key: hero, span: 2, rows: 2 },
    // Two figures stack (one per row); otherwise they pack two to a row.
    ...packBento(
      beside.length === 2 ? beside.map((tile) => ({ ...tile, span: 2 })) : beside,
      2,
    ).map((tile) => ({ ...tile, rows: beside.length === 1 ? 2 : 1 })),
  ];
  const spare = figures.slice(4, 6);
  if (!second) return [...lead, ...row([...figures.slice(4), ...sections])];
  if (!spare.length) return [...lead, ...row([{ key: second, span: 2 }, ...sections])];
  return [...lead, ...pair(second, spare, 2), ...row([...figures.slice(6), ...sections])];
}
