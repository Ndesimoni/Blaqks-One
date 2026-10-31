import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REVEAL_MARGIN,
  focusAndRevealField,
  nearestScrollOffset,
} from '../../src/features/records/revealField.js';

const view = { top: 100, bottom: 500 };

test('nearest scroll offset leaves visible targets alone and fits hidden ones minimally', () => {
  assert.equal(nearestScrollOffset(view, { top: 200, bottom: 300 }, 16), 0);
  assert.equal(nearestScrollOffset(view, { top: 116, bottom: 484 }, 16), 0);
  assert.equal(nearestScrollOffset(view, { top: 450, bottom: 520 }, 16), 36);
  assert.equal(nearestScrollOffset(view, { top: 60, bottom: 140 }, 16), -56);
  assert.equal(nearestScrollOffset(view, { top: 450, bottom: 520 }), 20);
});

test('a target taller than the view keeps its top (label) visible', () => {
  assert.equal(nearestScrollOffset(view, { top: 300, bottom: 900 }, 16), 184);
  assert.equal(nearestScrollOffset(view, { top: 20, bottom: 900 }, 16), -96);
});

function fixture({ fieldRect, reduced = false }) {
  const calls = { focus: [], scroll: [] };
  globalThis.matchMedia = (query) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
  });
  const wrapper = { getBoundingClientRect: () => fieldRect };
  const element = {
    focus: (options) => calls.focus.push(options),
    closest: (selector) => (selector === '.field' ? wrapper : null),
  };
  const container = {
    clientTop: 0,
    clientHeight: 400,
    getBoundingClientRect: () => ({ top: 100 }),
    scrollBy: (options) => calls.scroll.push(options),
  };
  return { calls, element, container };
}

test('focus skips the browser scroll and reveals the whole field wrapper with its error', () => {
  const { calls, element, container } = fixture({ fieldRect: { top: 420, bottom: 510 } });
  focusAndRevealField(element, container);
  assert.deepEqual(calls.focus, [{ preventScroll: true }]);
  assert.deepEqual(calls.scroll, [{ top: 10 + REVEAL_MARGIN, behavior: 'smooth' }]);
  delete globalThis.matchMedia;
});

test('reduced motion scrolls instantly and visible fields are not scrolled', () => {
  const reduced = fixture({ fieldRect: { top: 420, bottom: 510 }, reduced: true });
  focusAndRevealField(reduced.element, reduced.container);
  assert.equal(reduced.calls.scroll[0].behavior, 'auto');
  const visible = fixture({ fieldRect: { top: 200, bottom: 280 } });
  focusAndRevealField(visible.element, visible.container);
  assert.deepEqual(visible.calls.scroll, []);
  delete globalThis.matchMedia;
});

test('missing elements are ignored and a missing container keeps native focus scrolling', () => {
  assert.doesNotThrow(() => focusAndRevealField(null, null));
  const { calls, element } = fixture({ fieldRect: { top: 0, bottom: 0 } });
  focusAndRevealField(element, null);
  assert.deepEqual(calls.focus, [{ preventScroll: false }]);
  delete globalThis.matchMedia;
});
