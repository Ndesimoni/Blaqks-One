export const VISIBLE_OPTION_LIMIT = 6;
export const optionKey = (_item, index) => index;

/** Preserve the complete order/indexes and promote the current choice in the compact view. */
export function partitionOptions(items, activeKey, getKey = optionKey) {
  const entries = items.map((item, index) => ({ item, index, key: getKey(item, index) }));
  const visible = entries.slice(0, VISIBLE_OPTION_LIMIT);
  const active = entries.find((entry) => entry.key === activeKey);
  if (active && !visible.includes(active)) visible[visible.length - 1] = active;
  const indexes = new Set(visible.map((entry) => entry.index));
  return { all: entries, visible, extra: entries.filter((entry) => !indexes.has(entry.index)) };
}
