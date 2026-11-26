import React from 'react';
import { ReasonDecisionDialog } from './RejectDialog.jsx';
import { entryKinds } from './entryFilters.js';

/**
 * Admin void of an approved payment or expense (finance-design §4, §16.3). Voiding is final:
 * the row stays visible as Voided with its reason and stops counting in every total.
 */
export function VoidDialog({ kind, entry, onClose }) {
  return (
    <ReasonDecisionDialog
      kind={kind}
      entry={entry}
      decision="void"
      title={`Void ${entryKinds[kind].noun}`}
      intro="Voiding is final. The record stays visible as Voided and no longer counts in totals."
      submitLabel="Void"
      onClose={onClose}
    />
  );
}
