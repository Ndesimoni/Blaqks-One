import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionOptions, VISIBLE_OPTION_LIMIT } from '../../src/lib/overflow.js';

test('overflow keeps six compact entries and a complete ordered list with original indexes and data', () => {
  for (const length of [0, 1, 5, 6, 7, 100]) {
    const items = Array.from({ length }, (_, index) => ({ id: `item-${index}` }));
    const before = JSON.stringify(items);
    const { all, visible, extra } = partitionOptions(items, undefined, (item) => item.id);
    assert.equal(visible.length, Math.min(length, VISIBLE_OPTION_LIMIT));
    assert.equal(extra.length, Math.max(0, length - VISIBLE_OPTION_LIMIT));
    assert.deepEqual(
      [...visible, ...extra].map((entry) => entry.index),
      items.map((_, index) => index),
    );
    assert.equal(JSON.stringify(items), before);
    assert.deepEqual(
      all.map((entry) => entry.index),
      items.map((_, index) => index),
    );
    assert.ok(all.every((entry) => entry.item === items[entry.index]));
  }
});

test('overflow promotes an active hidden choice without losing the displaced option or changing order/indexes', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ id: `step-${index}` }));
  const { all, visible, extra } = partitionOptions(items, 'step-7', (item) => item.id);
  assert.deepEqual(
    visible.map((entry) => entry.index),
    [0, 1, 2, 3, 4, 7],
  );
  assert.deepEqual(
    extra.map((entry) => entry.index),
    [5, 6],
  );
  assert.equal(new Set([...visible, ...extra].map((entry) => entry.key)).size, items.length);
  assert.deepEqual(
    all.map((entry) => entry.index),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    partitionOptions(items, 'missing', (item) => item.id).visible.map((entry) => entry.index),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    partitionOptions(items, 0).visible.map((entry) => entry.index),
    [0, 1, 2, 3, 4, 5],
  );
});
