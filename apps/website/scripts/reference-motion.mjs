// Motion for the recovered main site. The hero entrance itself is CSS (reference-motion.css);
// this module keeps it seamless when the engine replaces the markup, gives the gold text links
// an underline label and a nudging arrow, and re-arms the scroll reveal after every render.
import { armReveal } from './motion/reveal.ts';
import { platformTargets } from './motion/targets.ts';

let dispose = () => {};
let clock = null;

const app = () => document.querySelector('#app');

function entrance() {
  const root = app();
  if (!root || typeof document.getAnimations !== 'function') return [];
  return document
    .getAnimations()
    .filter(
      (animation) =>
        /^motion-/.test(animation.animationName || '') && root.contains(animation.effect?.target),
    );
}

/** Before a render: remember when the entrance already on screen began. */
export function motionBeforeRender() {
  const times = entrance()
    .map((animation) => animation.startTime)
    .filter((time) => time !== null);
  clock = times.length ? Math.min(...times) : null;
}

/** After a render: the new markup continues that entrance instead of starting it again. */
function resumeEntrance() {
  if (clock === null) return;
  for (const animation of entrance()) animation.startTime = clock;
  clock = null;
}

/** "View all properties →" becomes a label that underlines and an arrow that nudges. */
function decorateLinks(root) {
  for (const link of root.querySelectorAll('.e-text, .u-card-link')) {
    const last = link.lastChild;
    if (link.childNodes.length !== 1 || last?.nodeType !== Node.TEXT_NODE) continue;
    const match = /^(\s*)(.*\S)\s+([→↗])\s*$/s.exec(last.data);
    if (!match) continue;
    const label = document.createElement('span');
    label.className = 'motion-label';
    label.textContent = match[2];
    const arrow = document.createElement('span');
    arrow.className = match[3] === '↗' ? 'motion-arrow motion-arrow-up' : 'motion-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = match[3];
    link.replaceChildren(label, ' ', arrow);
  }
}

export function motionAfterRender() {
  const root = app();
  if (!root) return;
  resumeEntrance();
  decorateLinks(root);
  dispose();
  dispose = armReveal(root, platformTargets);
}
