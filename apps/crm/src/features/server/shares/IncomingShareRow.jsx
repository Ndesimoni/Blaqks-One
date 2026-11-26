import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

export const shareIcons = Object.freeze({
  Clients: 'target',
  Properties: 'building',
  Contacts: 'person',
});

/**
 * One offer waiting for the caller: before accepting it shows only the type, the label, the
 * sender and the dates (amendment 7). Decline sits before the positive Accept.
 */
export function IncomingShareRow({ share, busy, onAnswer }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const label = share.label || k('noLabel');
  const names = { label, name: share.from.name };
  return (
    <li className="record-share-offer">
      <span className="assignment-icon" aria-hidden="true">
        <Icon name={shareIcons[share.collection]} size={18} />
      </span>
      <div className="record-share-text">
        <strong>{label}</strong>
        <span>
          {k('incomingFrom', { type: k(`type.${share.collection}`), name: share.from.name })}
        </span>
        <small>
          {k('sentOn', { date: format.dateTime(share.createdAt) })}
          {share.expiresAt ? ` · ${k('answerBy', { date: format.date(share.expiresAt) })}` : ''}
        </small>
      </div>
      <div className="record-share-actions" role="group" aria-label={label}>
        {share.allowed.decline && (
          <Button
            variant="light"
            disabled={busy}
            aria-label={k('declineLabel', names)}
            onClick={() => onAnswer(share, 'decline')}
          >
            {k('decline')}
          </Button>
        )}
        {share.allowed.accept && (
          <Button
            icon="check"
            disabled={busy}
            aria-label={k('acceptLabel', names)}
            onClick={() => onAnswer(share, 'accept')}
          >
            {k('accept')}
          </Button>
        )}
      </div>
    </li>
  );
}
