import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button.jsx';
import { routePath } from '../../../config/routes.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { allowedActions, inCompany } from './agreementModel.js';

/** Commands that cannot be taken back ask once more, naming what will happen. */
const CONFIRMED = [
  'send',
  'accept',
  'decline',
  'revoke',
  'acceptAmendment',
  'declineAmendment',
  'complete',
  'cancel',
  'archive',
];
const DANGER = ['decline', 'revoke', 'declineAmendment', 'cancel', 'archive'];
const lifecycle = (name) =>
  ['amend', 'acceptAmendment', 'declineAmendment', 'complete', 'cancel', 'archive'].includes(name);

/**
 * Exactly the commands the caller may take now (agreementModel `allowedActions`). Editing
 * and counter-offers open the form; the others confirm first. One primary action at most:
 * Send for a draft, Accept for an offer. An in-company hand-over is decided in Deals.
 */
export function AgreementActions({ view, onEdit, onClose, onDone, proposalReviewed }) {
  const { t } = useI18n();
  const go = useNavigate();
  const [confirming, setConfirming] = useState(null);
  const { detail, busy, run } = view;
  const { agreement, revision, party } = detail;
  const actions = allowedActions({ agreement, authorParty: revision.authorParty, party });
  Object.entries(detail.lifecycle?.allowed || {}).forEach(([name, allowed]) => {
    if (allowed && (!name.endsWith('Amendment') || proposalReviewed)) actions.push(name);
  });
  if (confirming)
    return (
      <div
        className="drawer-footer agreement-confirm"
        role="group"
        aria-labelledby="agreement-confirm"
      >
        <p id="agreement-confirm">
          {t(
            `${lifecycle(confirming) ? 'agreementLifecycle' : 'agreements'}.confirm.${confirming}`,
            {
              number: confirming.endsWith('Amendment') ? detail.proposal?.number : revision.number,
            },
          )}
        </p>
        <Button variant="light" disabled={busy} onClick={() => setConfirming(null)}>
          {t('agreements.action.back')}
        </Button>
        <Button
          variant={DANGER.includes(confirming) ? 'danger-light' : 'primary'}
          disabled={busy}
          autoFocus
          onClick={async () => {
            const done = await run(
              confirming,
              confirming.endsWith('Amendment') ? detail.proposal?.id : undefined,
            );
            setConfirming(null);
            if (done) {
              onDone();
              if (confirming === 'archive') onClose();
            }
          }}
        >
          {busy
            ? t('agreements.action.working')
            : t(
                lifecycle(confirming)
                  ? `agreementLifecycle.${confirming}`
                  : `agreements.action.${confirming}Confirm`,
              )}
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
        {t(
          lifecycle(name)
            ? `agreementLifecycle.${name === 'cancel' && detail.lifecycle?.cancellation?.[party === 'sender' ? 'recipient' : 'sender'] ? 'agreeCancel' : name}`
            : `agreements.action.${name}`,
        )}
      </Button>
    );
  return (
    <div className="drawer-footer agreement-actions">
      {!party && !inCompany(agreement) && ['draft', 'sent'].includes(agreement.state) && (
        <p className="agreement-muted">{t('agreements.actions.participantsOnly')}</p>
      )}
      {inCompany(agreement) && agreement.state === 'sent' && (
        <p className="agreement-muted">{t('agreements.actions.inDeals')}</p>
      )}
      <Button variant="light" disabled={busy} onClick={onClose}>
        {t('agreements.action.close')}
      </Button>
      {inCompany(agreement) && agreement.state === 'sent' && (
        <Button variant="primary" onClick={() => go(routePath('Deals'))}>
          {t('agreements.action.openDeals')}
        </Button>
      )}
      {button('revoke', 'danger-light')}
      {button('decline', 'danger-light')}
      {button('counter')}
      {button('revise')}
      {button('send', 'primary')}
      {button('accept', 'primary')}
      {button('archive', 'danger-light')}
      {button('cancel', 'danger-light')}
      {button('declineAmendment', 'danger-light')}
      {button('amend')}
      {button('complete')}
      {button('acceptAmendment', 'primary')}
    </div>
  );
}
