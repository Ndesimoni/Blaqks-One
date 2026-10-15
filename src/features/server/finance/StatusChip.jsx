import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { entryStatusLabels } from './entryModel.js';

const tones = Object.freeze({
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  void: 'slate',
});

/** A payment or expense status: always its text label, with colour only as a second cue. */
export function StatusChip({ status }) {
  return <Badge tone={tones[status] ?? 'slate'}>{entryStatusLabels[status] ?? status}</Badge>;
}
