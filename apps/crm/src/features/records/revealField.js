/** Breathing room kept between a revealed field and the editor's header/footer edges. */
export const REVEAL_MARGIN = 16;

/**
 * Smallest vertical scroll that fits `target` (plus `margin`) inside `view`, both as
 * `{ top, bottom }` viewport rects. A target taller than the view keeps its top visible.
 */
export function nearestScrollOffset(view, target, margin = 0) {
  const top = target.top - margin;
  const bottom = target.bottom + margin;
  if (top < view.top) return top - view.top;
  if (bottom > view.bottom) return Math.min(bottom - view.bottom, top - view.top);
  return 0;
}

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Focuses a form control without the browser's minimal scroll, then scrolls its `.field`
 * wrapper (label, control, hint and error) fully into the editor body's visible area.
 */
export function focusAndRevealField(element, container) {
  if (!element) return;
  element.focus({ preventScroll: Boolean(container) });
  if (!container) return;
  const wrapper = element.closest('.field') || element;
  const box = container.getBoundingClientRect();
  const top = box.top + container.clientTop;
  const view = { top, bottom: top + container.clientHeight };
  const offset = nearestScrollOffset(view, wrapper.getBoundingClientRect(), REVEAL_MARGIN);
  if (!offset) return;
  container.scrollBy({ top: offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
