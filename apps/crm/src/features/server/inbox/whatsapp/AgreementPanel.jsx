import React, { useRef, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { RestoreField, SourceChoice, StopConfirm } from './AgreementParts.jsx';
import { consentActions, consentKey } from './whatsappModel.js';

/**
 * The client's agreement to WhatsApp messages (WQ2, design §10): record how they agreed
 * (Admin or staff with the WhatsApp grant), record STOP for them (anyone who sees them, after
 * a confirmation), or, for the Admin after a STOP, restore it with a written reason.
 * `onRecord(change)` resolves to '' or the server's reason; the panel closes on success.
 */
export function AgreementPanel({ id, consent, user, onRecord, onClose }) {
  const { t, format } = useI18n();
  const can = consentActions(user, consent);
  const [source, setSource] = useState('');
  const [reason, setReason] = useState('');
  const [stopping, setStopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState('');
  const first = useRef(null);
  const save = async (change) => {
    setBusy(true);
    const failure = await onRecord(change);
    setBusy(false);
    setStopping(false);
    if (failure) setError(t('whatsappSend.agreement.failed', { reason: failure }));
    else onClose();
  };
  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (can.agree && !source) {
      setProblem('agreement.chooseSource');
      first.current?.focus();
    } else if (can.restore && !reason.trim()) {
      setProblem('agreement.restoreNeeded');
      first.current?.focus();
    } else if (can.agree) save({ change: 'agreed', source });
    else if (can.restore) save({ change: 'restored', reason: reason.trim() });
  };
  const granted = user?.roleId === 'admin' || user?.channelAccess?.whatsapp === true;
  const state = consent?.state || 'none';
  const note =
    (state === 'none' && !granted && 'agreement.noGrant') ||
    (state === 'opt_in' && 'agreement.agreedNote') ||
    (state === 'opt_out' && !can.restore && 'agreement.adminOnly');
  return (
    <form id={id} className="wa-agreement" aria-labelledby={`${id}-title`} onSubmit={submit}>
      <div className="wa-agreement-head">
        <h3 id={`${id}-title`}>{t('whatsappSend.agreement.title')}</h3>
        <span className={`wa-consent is-${state}`}>
          {t(`whatsappSend.${consentKey(consent)}`)}
          {consent?.at &&
            ` · ${t('whatsappSend.consent.since', { date: format.date(consent.at) })}`}
        </span>
      </div>
      {note && <p className="wa-note">{t(`whatsappSend.${note}`)}</p>}
      {can.agree && (
        <SourceChoice
          id={id}
          value={source}
          first={first}
          problem={problem}
          onChange={(next) => {
            setSource(next);
            setProblem('');
          }}
        />
      )}
      {can.restore && (
        <RestoreField
          id={id}
          value={reason}
          field={first}
          problem={problem}
          onChange={(next) => {
            setReason(next);
            setProblem('');
          }}
        />
      )}
      {stopping ? (
        <StopConfirm
          busy={busy}
          onConfirm={() => save({ change: 'stopped' })}
          onCancel={() => setStopping(false)}
        />
      ) : (
        <div className="wa-agreement-actions">
          {can.stop && (
            <Button variant="danger-light" disabled={busy} onClick={() => setStopping(true)}>
              {t('whatsappSend.agreement.stop')}
            </Button>
          )}
          <span className="wa-spacer" />
          <Button variant="light" disabled={busy} onClick={onClose}>
            {t(
              can.agree || can.restore
                ? 'whatsappSend.agreement.cancel'
                : 'whatsappSend.agreement.close',
            )}
          </Button>
          {(can.agree || can.restore) && (
            <Button type="submit" disabled={busy}>
              {busy
                ? t('whatsappSend.agreement.saving')
                : t(can.agree ? 'whatsappSend.agreement.record' : 'whatsappSend.agreement.restore')}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
