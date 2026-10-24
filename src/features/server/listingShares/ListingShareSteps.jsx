import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiDay } from './listingShareLinks.js';

/** A later last day to offer first: 30 days after the current end, at most 90 from today. */
function suggested(viewEndsAt) {
  const end = Date.parse(viewEndsAt);
  const later = dubaiDay(30, Number.isNaN(end) ? Date.now() : end);
  const latest = dubaiDay(90);
  return later > latest ? latest : later;
}

/**
 * The sender side's steps on a share (record sharing R2): Withdraw a pending offer, Stop
 * sharing or Extend an accepted one, and, for every reader, the evidence file. Each step
 * follows the server's `allowed` flags; Withdraw and Stop ask for confirmation first.
 * Co-broking is the dialog's main footer step (ListingShareDetail).
 */
export function ListingShareSteps({ share, busy, onConfirm, onExtend, onEvidence }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const id = useId();
  const [day, setDay] = useState(() => suggested(share.viewEndsAt));
  return (
    <section className="agreement-facts outside-share-steps" aria-label={k('stepsLabel')}>
      {share.allowed.extend && (
        <div className="outside-share-extend">
          <div className="field">
            <label htmlFor={id}>{k('newLastDay')}</label>
            <input
              id={id}
              type="date"
              min={dubaiDay(0)}
              max={dubaiDay(90)}
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          </div>
          <Button variant="light" disabled={busy || !day} onClick={() => onExtend(day)}>
            {k('extend')}
          </Button>
        </div>
      )}
      <div className="record-share-links">
        {share.allowed.withdraw && (
          <Button variant="light" disabled={busy} onClick={() => onConfirm('withdraw')}>
            {k('withdraw')}
          </Button>
        )}
        {share.allowed.stop && (
          <Button variant="light" disabled={busy} onClick={() => onConfirm('stop')}>
            {k('stop')}
          </Button>
        )}
        {share.allowed.evidence && (
          <Button variant="light" icon="download" disabled={busy} onClick={onEvidence}>
            {k('evidence')}
          </Button>
        )}
      </div>
    </section>
  );
}
