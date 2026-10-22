import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { allowedActions } from './agreementModel.js';

/** Commands that cannot be taken back ask once more, naming what will happen. */
const CONFIRMED = ['send', 'accept', 'decline', 'revoke'];
const DANGER = ['decline', 'revoke'];

/**
 * Exactly the commands the caller may take now (agreementModel `allowedActions`). Editing
 * and counter-offers open the form; the others confirm first. One primary action at most:
 * Send for a draft, Accept for an offer.
 */
export function AgreementActions({ view, onEdit, onClose, onDone }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(null);
  const { detail, busy, run } = view;
  const { agreement, revision, party } = detail;
  const actions = allowedActions({ agreement, authorParty: revision.authorParty, party });
  if (confirming)
    return (
      <div
        className="drawer-footer agreement-confirm"
        role="group"
        aria-labelledby="agreement-confirm"
      >
        <p id="agreement-confirm">
          {t(`agreements.confirm.${confirming}`, { number: revision.number })}
        </p>
        <Button variant="light" disabled={busy} onClick={() => setConfirming(null)}>
          {t('agreements.action.back')}
        </Button>
        <Button
          variant={DANGER.includes(confirming) ? 'danger-light' : 'primary'}
          disabled={busy}
          autoFocus
          onClick={async () => {
            const done = await run(confirming);
            setConfirming(null);
            if (done) onDone();
          }}
        >
          {busy ? t('agreements.action.working') : t(`agreements.action.${confirming}Confirm`)}
        </Button>
      </div>
    );
  const button = (name, variant = 'light') =>
    actions.includes(name) && (
      <Button
        key={name}
        variant={variant}
        disabled={busy}
        onClick={() => (CONFIRMED.includes(name) ? setConfirming(name) : onEdit(name, detail))}
      >
        {t(`agreements.action.${name}`)}
      </Button>
    );
  return (
    <div className="drawer-footer agreement-actions">
      {!party && ['draft', 'sent'].includes(agreement.state) && (
        <p className="agreement-muted">{t('agreements.actions.participantsOnly')}</p>
      )}
      <Button variant="light" disabled={busy} onClick={onClose}>
        {t('agreements.action.close')}
      </Button>
      {button('revoke', 'danger-light')}
      {button('decline', 'danger-light')}
      {button('counter')}
      {button('revise')}
      {button('send', 'primary')}
      {button('accept', 'primary')}
    </div>
  );
}
