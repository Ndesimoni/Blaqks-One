// Pure timing and eligibility rules for the websites' scroll reveal (no DOM access here).

export const REVEAL = {
  /** Fade-up length, in milliseconds. */
  duration: 700,
  /** Rise distance, in pixels. */
  distance: 16,
  /** Gap between items revealed together, in milliseconds. */
  step: 70,
  /** Only the first six items of a batch are staggered; the rest start with the sixth. */
  cap: 6,
  /** Share of an element that must be visible before it reveals. */
  threshold: 0.15,
  /** Trigger slightly before the bottom edge, so content rises as it arrives. */
  rootMargin: '0px 0px -6% 0px',
  easing: 'cubic-bezier(.2,.7,.2,1)',
} as const;

type Box = { top: number; left: number; height: number; bottom: number };

/** Delay for the nth element of a batch, capped so no card waits long. */
export function revealDelay(index: number): number {
  const position = Math.max(0, Math.floor(index));
  return Math.min(position, REVEAL.cap - 1) * REVEAL.step;
}

/**
 * Only content entirely below the fold when the page settles may be hidden. Anything already
 * in view keeps its place, and blocks taller than two screens are never hidden.
 */
export function revealable(box: Box, viewport: number): boolean {
  return box.height > 0 && box.top >= viewport && box.height <= viewport * 2;
}

/** What a fallback sweep should do with a pending element at the current scroll position. */
export function sweepAction(box: Box, viewport: number): 'show' | 'animate' | 'wait' {
  if (box.bottom <= 0) return 'show';
  return box.top < viewport * 0.85 ? 'animate' : 'wait';
}

/** Reading order for a batch: rows from the top, then left to right. */
export function readingOrder<T>(items: T[], box: (item: T) => Box): T[] {
  return [...items].sort((a, b) => {
    const one = box(a);
    const two = box(b);
    return Math.abs(one.top - two.top) > 8 ? one.top - two.top : one.left - two.left;
  });
}

/** Keep the outermost matches, so a nested block never fades twice. */
export function outermost<T extends { contains(other: T): boolean }>(nodes: T[]): T[] {
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
}
