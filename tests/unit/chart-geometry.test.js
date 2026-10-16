import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areaPath,
  linePath,
  niceMax,
  percentOf,
  ringDashes,
  seriesPoints,
  shares,
} from '../../src/components/charts/chartGeometry.js';

test('nice ceilings round up to 1, 2, 2.5 or 5 of a power of ten', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(-4), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(180), 200);
  assert.equal(niceMax(2_100), 2_500);
  assert.equal(niceMax(41_000), 50_000);
  assert.equal(niceMax(100), 100);
});

test('series points sit at column centres and scale to the ceiling', () => {
  assert.deepEqual(seriesPoints([0, 50, 100], 100, 300, 200), [
    [50, 200],
    [150, 100],
    [250, 0],
  ]);
  assert.deepEqual(seriesPoints([-5], 10, 100, 20), [[50, 20]]);
  assert.equal(
    linePath([
      [0, 1],
      [2, 3],
    ]),
    'M0 1 L2 3',
  );
  assert.equal(
    areaPath(
      [
        [10, 5],
        [20, 0],
      ],
      30,
    ),
    'M10 5 L20 0 L20 30 L10 30 Z',
  );
  assert.equal(areaPath([], 30), '');
});

test('shares always total 100 when anything is present', () => {
  assert.deepEqual(shares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(shares([3, 1]), [75, 25]);
  assert.deepEqual(shares([0, 0]), [0, 0]);
  const many = shares([7, 3, 5, 9, 11, 2]);
  assert.equal(
    many.reduce((sum, value) => sum + value, 0),
    100,
  );
});

test('ring dashes follow each other from the top with gaps between present parts', () => {
  const dashes = ringDashes([300, 100, 0], 100, 2);
  assert.deepEqual(dashes[0], { length: 72, offset: 0 });
  assert.deepEqual(dashes[1], { length: 24, offset: -74 });
  assert.deepEqual(dashes[2], { length: 0, offset: -100 });
  assert.deepEqual(ringDashes([5], 100, 2), [{ length: 100, offset: 0 }]);
  assert.deepEqual(ringDashes([0, 0], 100, 2), [
    { length: 0, offset: 0 },
    { length: 0, offset: 0 },
  ]);
});

test('target percentages need a positive target', () => {
  assert.equal(percentOf(50, 200), 25);
  assert.equal(percentOf(300, 200), 150);
  assert.equal(percentOf(50, 0), null);
  assert.equal(percentOf(50, null), null);
});
