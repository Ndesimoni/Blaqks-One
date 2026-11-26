import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS,
  tourPlacement,
  tourTarget,
} from '../../src/features/server/products/tourModel.js';

const viewport = { width: 1440, height: 900 };
const box = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

test('the tour starts at Home, walks the sidebar and ends at search', () => {
  assert.equal(TOUR_STEPS[0], 'home');
  assert.equal(TOUR_STEPS.at(-1), 'search');
});

test('a sidebar item gets the bubble to its right, kept on screen', () => {
  const place = tourPlacement(box(6, 120, 64, 56), viewport);
  assert.equal(place.side, 'right');
  assert.equal(place.style.left, 84);
  assert.equal(place.arrow, 120 + 28 - place.style.top - 7);
  const low = tourPlacement(box(6, 860, 64, 30), viewport);
  assert.ok(low.style.top <= viewport.height - 210);
});

test('the top bar gets the bubble below; the phone bar gets it above', () => {
  const below = tourPlacement(box(700, 14, 300, 40), viewport);
  assert.equal(below.side, 'below');
  assert.equal(below.style.top, 66);
  const phone = { width: 390, height: 844 };
  const above = tourPlacement(box(80, 790, 60, 50), phone);
  assert.equal(above.side, 'above');
  assert.equal(above.style.bottom, 844 - 790 + 12);
  assert.ok(above.style.left >= 16 && above.style.left + above.style.width <= 390 - 16);
});

test('the target is the first visible element with the mark', () => {
  const hidden = { getBoundingClientRect: () => box(0, 0, 0, 0) };
  const shown = { getBoundingClientRect: () => box(0, 0, 40, 40) };
  const root = { querySelectorAll: () => [hidden, shown] };
  assert.equal(tourTarget('crm', root), shown);
  assert.equal(tourTarget('crm', { querySelectorAll: () => [hidden] }), null);
});
