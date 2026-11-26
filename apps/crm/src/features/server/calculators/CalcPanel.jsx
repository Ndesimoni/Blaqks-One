import React, { useId } from 'react';
import { CalcResult } from './CalcResult.jsx';

/**
 * One calculator as the approved mockup lays it out (design queue item 12): its fields and
 * note in a card on the left, the Result card on the right (stacked on narrow screens).
 * `result` is passed through to the Result card.
 */
export function CalcPanel({ title, note, children, result }) {
  const uid = useId();
  return (
    <div className="calc-layout">
      <section className="panel calc-card" aria-labelledby={`${uid}-title`}>
        <h3 id={`${uid}-title`}>{title}</h3>
        {children}
        {note}
      </section>
      <CalcResult title={title} {...result} />
    </div>
  );
}
