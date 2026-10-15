import React from 'react';
import { entryStatusLabels } from './entryModel.js';

const tones = Object.freeze({
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  void: 'slate',
});

/** One small glyph per status, so the state never relies on colour alone. */
const glyphs = Object.freeze({
  pending: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.2l2 1.3" />
    </>
  ),
  approved: <path d="m4 8.4 2.6 2.6L12 5.4" />,
  rejected: <path d="m5 5 6 6M11 5l-6 6" />,
  void: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m3.8 12.2 8.4-8.4" />
    </>
  ),
});

/**
 * A payment or expense status: its text label first, with a matching glyph and tone as
 * second cues. Uses the shared badge tones so both themes keep their tested contrast.
 */
export function StatusChip({ status }) {
  const tone = tones[status] ?? 'slate';
  return (
    <span className={`badge badge-${tone} finance-status-chip`} data-status={status}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        {glyphs[status] ?? <circle cx="8" cy="8" r="2.5" />}
      </svg>
      {entryStatusLabels[status] ?? status}
    </span>
  );
}
