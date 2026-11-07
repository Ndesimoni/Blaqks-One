import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import {
  REVEAL,
  outermost,
  readingOrder,
  revealDelay,
  revealable,
  sweepAction,
} from '../src/lib/motion/reveal-rules.ts';
import { companyTargets, platformTargets } from '../src/lib/motion/targets.ts';

const box = (top: number, height = 100, left = 0) => ({ top, left, height, bottom: top + height });

test('a batch staggers 70 ms apart and stops growing after the sixth item', () => {
  assert.deepEqual([0, 1, 2, 5, 6, 11].map(revealDelay), [0, 70, 140, 350, 350, 350]);
  assert.equal(revealDelay(-3), 0);
  assert.ok(REVEAL.step >= 60 && REVEAL.step <= 80);
  assert.equal(REVEAL.cap, 6);
});

test('only blocks wholly below the fold are hidden, never tall or empty ones', () => {
  assert.equal(revealable(box(900), 900), true);
  assert.equal(revealable(box(899), 900), false, 'already peeking into view');
  assert.equal(revealable(box(-400), 900), false, 'above the viewport');
  assert.equal(revealable(box(1200, 0), 900), false, 'collapsed or hidden');
  assert.equal(revealable(box(1200, 1801), 900), false, 'taller than two screens');
});

test('the safety sweep shows passed blocks at once and reveals blocks well in view', () => {
  assert.equal(sweepAction(box(-300, 200), 900), 'show');
  assert.equal(sweepAction(box(400), 900), 'animate');
  assert.equal(sweepAction(box(880), 900), 'wait');
});

test('batches reveal in reading order, and nested matches fade once', () => {
  const items = [box(500, 10, 300), box(100, 10, 600), box(503, 10, 0), box(100, 10, 20)];
  const order = readingOrder(items, (item) => item).map((item) => [item.top, item.left]);
  assert.deepEqual(order, [
    [100, 20],
    [100, 600],
    [503, 0],
    [500, 300],
  ]);
  const node = (name: string, children: string[] = []) => ({
    name,
    contains: (other: { name: string }) => children.includes(other.name),
  });
  const kept = outermost([node('grid', ['card']), node('card'), node('head')]);
  assert.deepEqual(
    kept.map((item) => item.name),
    ['grid', 'head'],
  );
});

test('reveal targets leave sticky panels, headers, footers and preview labels alone', () => {
  for (const selector of [companyTargets, platformTargets])
    for (const excluded of [
      'aside',
      'enquiry-panel',
      'preview',
      'sample-banner',
      'header',
      'footer',
    ])
      assert.doesNotMatch(selector, new RegExp(excluded));
});

const guarded = (file: string) => {
  const css = postcss.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const loose: string[] = [];
  css.walkDecls(/^(animation|transition|translate|scale|transform)$/, (decl) => {
    // Static underline states (scaleX(0) and none) are not movement and work in every mode.
    if (decl.prop === 'transform' && /^(none|scaleX\(0\))$/.test(decl.value)) return;
    if (!/motion-|translate|scale|transform/.test(decl.prop + ' ' + decl.value)) return;
    let parent = decl.parent?.parent;
    while (parent && parent.type !== 'root') {
      const rule = parent as postcss.AtRule;
      // Keyframes only describe a path; the rule that plays them must be guarded.
      if (parent.type === 'atrule' && /keyframes|no-preference/.test(rule.name + rule.params))
        return;
      parent = parent.parent;
    }
    loose.push(`${(decl.parent as postcss.Rule).selector} { ${decl.prop}: ${decl.value} }`);
  });
  return loose;
};

test('every entrance, zoom, lift and nudge sits inside a reduced-motion guard', () => {
  for (const file of [
    '../src/styles/motion.css',
    '../src/styles/motion-classic.css',
    '../src/styles/atelier-motion.css',
    '../src/styles/harbour-motion.css',
    '../src/styles/homeverse-motion.css',
    '../scripts/reference-motion.css',
    '../scripts/reference-motion-hover.css',
  ])
    assert.deepEqual(guarded(file), [], file);
});

test('the generated bundles carry the motion styles, theme 1 hero only for theme 1', () => {
  const main = readFileSync(new URL('../public/approved/reference.css', import.meta.url), 'utf8');
  const company = readFileSync(new URL('../public/approved/company.css', import.meta.url), 'utf8');
  assert.match(main, /@keyframes motion-rise/);
  assert.match(main, /\.e-hero:{1,2}after\{content:""/);
  assert.match(company, /data-theme="2"\] \.v-hero-image\{animation:motion-settle/);
  assert.doesNotMatch(company, /data-theme="2"\] \.a-reference-house>img\{animation/);
});
