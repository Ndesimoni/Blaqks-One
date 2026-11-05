/** The start page tour (owner, 2026-11-05): each step names a part of the app by its mark. */
export const TOUR_STEPS = [
  'home',
  'crm',
  'web',
  'market',
  'messages',
  'platform',
  'settings',
  'search',
];

const shown = (el) => {
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
};

/** The first visible element with this mark: the sidebar when wide, the bottom bar on phones. */
export function tourTarget(key, root = globalThis.document) {
  return [...(root?.querySelectorAll(`[data-tour="${key}"]`) ?? [])].find(shown) ?? null;
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * Where the bubble sits beside its target: right of the sidebar, above anything in the lower
 * half (the phone bar), otherwise below. `arrow` points at the target's middle.
 */
export function tourPlacement(box, viewport) {
  const width = Math.min(300, viewport.width - 32);
  if (box.right < 120) {
    const middle = box.top + box.height / 2;
    const top = clamp(middle - 32, 12, viewport.height - 210);
    return { side: 'right', style: { left: box.right + 14, top, width }, arrow: middle - top - 7 };
  }
  const left = clamp(box.left + box.width / 2 - width / 2, 16, viewport.width - width - 16);
  const arrow = box.left + box.width / 2 - left - 7;
  if (box.top > viewport.height / 2)
    return { side: 'above', style: { left, bottom: viewport.height - box.top + 12, width }, arrow };
  return { side: 'below', style: { left, top: box.bottom + 12, width }, arrow };
}
