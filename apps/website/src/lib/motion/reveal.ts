// Scroll reveal shared by the company websites and the recovered main-site engine.
// Content is never hidden by CSS: below-the-fold blocks are held by a paused Web Animation
// after hydration, released once when they arrive, and every safety path shows them.
import {
  REVEAL,
  outermost,
  readingOrder,
  revealDelay,
  revealable,
  sweepAction,
} from './reveal-rules.ts';

const idle = () => {};

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function motionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'IntersectionObserver' in window &&
    typeof Element.prototype.animate === 'function' &&
    !prefersReducedMotion()
  );
}

/** Horizontal strips scroll sideways; their items are left alone. */
function insideScroller(node: HTMLElement): boolean {
  for (let parent = node.parentElement; parent && parent !== document.body;) {
    const { overflowX } = getComputedStyle(parent);
    if (/(auto|scroll)/.test(overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
    parent = parent.parentElement;
  }
  return false;
}

function hold(node: HTMLElement): Animation {
  const animation = node.animate([{ opacity: 0, translate: `0 ${REVEAL.distance}px`, offset: 0 }], {
    duration: REVEAL.duration,
    easing: REVEAL.easing,
    fill: 'backwards',
  });
  animation.pause();
  return animation;
}

/**
 * Hide the matching blocks that are still below the fold, then fade each up once as it
 * enters the viewport. Returns a disposer that shows anything still waiting.
 */
export function armReveal(root: ParentNode, selector: string): () => void {
  if (!motionSupported()) return idle;
  const viewport = innerHeight;
  const nodes = outermost([...root.querySelectorAll<HTMLElement>(selector)]).filter(
    (node) => revealable(node.getBoundingClientRect(), viewport) && !insideScroller(node),
  );
  if (!nodes.length) return idle;
  const pending = new Map(nodes.map((node) => [node, hold(node)] as const));
  document.documentElement.classList.add('motion-ready');
  const box = (node: Element) => node.getBoundingClientRect();
  const release = (batch: Element[], animate: boolean) => {
    readingOrder(batch, box).forEach((node, index) => {
      const animation = pending.get(node as HTMLElement);
      if (!animation) return;
      pending.delete(node as HTMLElement);
      observer.unobserve(node);
      if (!animate) return animation.cancel();
      animation.effect?.updateTiming({ delay: revealDelay(index) });
      animation.play();
    });
    if (!pending.size) stop();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      const arrived = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      if (arrived.length) release(arrived, true);
    },
    { threshold: REVEAL.threshold, rootMargin: REVEAL.rootMargin },
  );
  // Safety net: anything scrolled past (e.g. after End or a jump link) appears at once, and
  // anything well inside the viewport is revealed even if the observer has not reported it.
  let frame = 0;
  const sweep = () => {
    frame = 0;
    const passed: Element[] = [];
    const visible: Element[] = [];
    for (const node of pending.keys()) {
      const action = sweepAction(box(node), innerHeight);
      if (action === 'show') passed.push(node);
      if (action === 'animate') visible.push(node);
    }
    if (passed.length) release(passed, false);
    if (visible.length) release(visible, true);
  };
  const onScroll = () => {
    frame ||= requestAnimationFrame(sweep);
  };
  const showAll = () => release([...pending.keys()], false);
  function stop() {
    observer.disconnect();
    cancelAnimationFrame(frame);
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    removeEventListener('beforeprint', showAll);
  }
  pending.forEach((_, node) => observer.observe(node));
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('beforeprint', showAll);
  return () => {
    showAll();
    stop();
  };
}
