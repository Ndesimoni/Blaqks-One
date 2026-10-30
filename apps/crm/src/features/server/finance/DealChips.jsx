import React from 'react';
import { paymentStatusLabels } from './financeLabels.js';

/** Small glyphs so a deal's stage and payment state never rely on colour alone. */
const glyphs = Object.freeze({
  done: <path d="m4 8.4 2.6 2.6L12 5.4" />,
  stop: <path d="m5 5 6 6M11 5l-6 6" />,
  wait: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.2l2 1.3" />
    </>
  ),
  pause: <path d="M6 4.5v7M10 4.5v7" />,
  open: <circle cx="8" cy="8" r="5.5" strokeDasharray="2.4 2" />,
  move: <path d="M3.5 8h8M8.5 5l3 3-3 3" />,
  estimate: <path d="M3 8h1.5M6.2 8h1.6M9.5 8H11M12.5 8H13" />,
});

/** One deal chip: the shared badge tones (tested contrast in both themes) plus a glyph. */
export function DealChip({ tone, glyph, children, className = '' }) {
  return (
    <span className={`badge badge-${tone} finance-status-chip deal-chip ${className}`}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        {glyphs[glyph]}
      </svg>
      {children}
    </span>
  );
}

const stageLooks = Object.freeze({
  New: ['slate', 'open'],
  Completed: ['green', 'done'],
  Lost: ['red', 'stop'],
  Cancelled: ['red', 'stop'],
  'On hold': ['slate', 'pause'],
});

/** The deal's pipeline stage: in-progress stages share one amber "moving" look. */
export function StageChip({ stage }) {
  const [tone, glyph] = stageLooks[stage] ?? ['amber', 'move'];
  return (
    <DealChip tone={tone} glyph={glyph} className="deal-stage-chip">
      {stage || '—'}
    </DealChip>
  );
}

const paymentLooks = Object.freeze({
  not_earned: ['slate', 'open'],
  outstanding: ['amber', 'wait'],
  paid: ['green', 'done'],
});

/** Commission payment state: Not earned, Outstanding or Paid. */
export function PaymentChip({ status }) {
  const [tone, glyph] = paymentLooks[status] ?? ['slate', 'open'];
  return (
    <DealChip tone={tone} glyph={glyph} className="deal-payment-chip">
      {paymentStatusLabels[status] ?? status}
    </DealChip>
  );
}

/** Marks figures as an estimate (unearned) or as fixed earned figures. */
export function FigureChip({ calculation }) {
  if (!calculation) return null;
  return calculation.preview ? (
    <DealChip tone="amber" glyph="estimate" className="deal-figure-chip">
      Estimate
    </DealChip>
  ) : (
    <DealChip tone="green" glyph="done" className="deal-figure-chip">
      Earned · revision {calculation.revision ?? 1}
    </DealChip>
  );
}
