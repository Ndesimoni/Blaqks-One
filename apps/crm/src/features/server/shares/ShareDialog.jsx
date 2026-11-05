import React, { useId, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { useShareActions } from './useShareActions.js';
import { useShareCandidates } from './useShareReads.js';
import { ShareSentDialog } from './ShareSentDialog.jsx';

/**
 * Share one record: choose a colleague who may receive it (amendment 2), then Send. The sent
 * share opens Copy link and Share on WhatsApp. A refusal keeps the choice and shows the
 * server's reason, such as "This colleague can't receive this record.".
 */
export function ShareDialog({ collection, recordId, onSent, onClose }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const fieldId = useId();
  const candidates = useShareCandidates(collection, recordId);
  const { busy, send } = useShareActions();
  const [toId, setToId] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(null);
  if (sent) return <ShareSentDialog share={sent} onClose={onClose} />;
  const { colleagues, loading, error } = candidates;
  const submit = async () => {
    if (!toId) return setMessage(k('chooseFirst'));
    setMessage('');
    const result = await send(collection, recordId, toId);
    if (!result.ok) return setMessage(result.message);
    onSent?.();
    setSent(result.share);
  };
  return (
    <FinanceDialog
      eyebrow={k('dialogEyebrow')}
      title={k('dialogTitle')}
      intro={k('dialogIntro')}
      busy={Boolean(busy)}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={k('send')}
      submitDisabled={loading || !colleagues.length}
      className="record-share-dialog"
    >
      {loading ? (
        <p role="status">{k('loadingColleagues')}</p>
      ) : error ? (
        <p className="field-error" role="alert">
          {k('colleaguesFailed')}
        </p>
      ) : !colleagues.length ? (
        <p className="record-share-empty">{k('noColleagues')}</p>
      ) : (
        <div className="field span-all">
          <label htmlFor={fieldId}>
            {k('colleague')}
            <span className="required"> *</span>
          </label>
          <select
            id={fieldId}
            value={toId}
            disabled={Boolean(busy)}
            aria-required="true"
            onChange={(event) => {
              setToId(event.target.value);
              setMessage('');
            }}
          >
            <option value="">{k('chooseColleague')}</option>
            {colleagues.map((colleague) => (
              <option key={colleague.id} value={colleague.id}>
                {colleague.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </FinanceDialog>
  );
}
