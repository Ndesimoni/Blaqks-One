import test from 'node:test';
import assert from 'node:assert/strict';
import { bentoLayout, packBento } from '../../src/features/server/dashboard/bentoLayout.js';

const tiles = (...spans) => spans.map((span, index) => ({ key: `t${index}`, span }));
const spans = (layout) => layout.map((tile) => tile.span);

test('rows of four never end with an empty cell', () => {
  assert.deepEqual(spans(packBento(tiles(1, 1, 2, 2, 1, 1, 3, 1))), [1, 1, 2, 2, 1, 1, 3, 1]);
  // Today (3) cannot follow pipeline and sources, so sources widens to close the row.
  assert.deepEqual(spans(packBento(tiles(2, 1, 3, 1))), [2, 2, 3, 1]);
  assert.deepEqual(spans(packBento(tiles(1, 1, 1))), [1, 1, 2]);
  assert.deepEqual(spans(packBento(tiles(5))), [4]);
  assert.deepEqual(packBento([]), []);
});

test('the hero takes 2 × 2 with up to four key figures beside it', () => {
  const layout = bentoLayout({
    hero: 'fees',
    second: 'finance',
    figures: tiles(1, 1, 1, 1, 1, 1),
    sections: [
      { key: 'pipeline', span: 2 },
      { key: 'sources', span: 2 },
      { key: 'today', span: 4 },
      { key: 'records', span: 2 },
    ],
  });
  assert.deepEqual(
    layout.map((tile) => [tile.key, tile.span, tile.rows]),
    [
      ['fees', 2, 2],
      ['t0', 1, 1],
      ['t1', 1, 1],
      ['t2', 1, 1],
      ['t3', 1, 1],
      ['finance', 2, 2],
      ['t4', 2, 1],
      ['t5', 2, 1],
      ['pipeline', 2, 1],
      ['sources', 2, 1],
      ['today', 4, 1],
      ['records', 4, 1],
    ],
  );
  const fewer = bentoLayout({
    hero: 'fees',
    second: 'finance',
    figures: tiles(1, 1),
    sections: [],
  });
  assert.deepEqual(
    fewer.map((tile) => [tile.key, tile.span]),
    [
      ['fees', 2],
      ['t0', 2],
      ['t1', 2],
      ['finance', 4],
    ],
  );
  const three = bentoLayout({ hero: 'fees', figures: tiles(1, 1, 1), sections: [] });
  assert.deepEqual(spans(three), [2, 1, 1, 2]);
  const one = bentoLayout({ hero: 'fees', figures: tiles(1), sections: [] });
  assert.deepEqual(one[1], { key: 't0', span: 2, rows: 2 });
  const plain = bentoLayout({ hero: null, figures: tiles(1, 1, 1, 1), sections: tiles(2) });
  assert.deepEqual(spans(plain), [1, 1, 1, 1, 4]);
});
