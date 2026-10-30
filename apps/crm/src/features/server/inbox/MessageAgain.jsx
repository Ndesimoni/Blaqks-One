import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * Send again under the author's own failed or unknown message (design §5). A failed message
 * was never accepted, so it sends at once; an unknown one may already have reached the
 * client, so the person confirms after checking (security review E1b note).
 */
export function MessageAgain({ message, onAgain }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true);
    const failure = await onAgain(message.id);
    setBusy(false);
    setAsking(false);
    setError(failure ? t('inboxSend.again.failed', { reason: failure }) : '');
  };
  const unknown = message.status === 'unknown';
  return (
    <div className="inbox-again">
      {asking ? (
        <div className="inbox-again-confirm" role="group" aria-label={t('inboxSend.again.button')}>
          <strong>{t('inboxSend.again.unknownTitle')}</strong>
          <span>{t('inboxSend.again.unknownBody')}</span>
          <div>
            <Button variant="light" disabled={busy} onClick={send}>
              {t('inboxSend.again.confirm')}
            </Button>
            <Button variant="light" disabled={busy} onClick={() => setAsking(false)}>
              {t('inboxSend.again.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="light" disabled={busy} onClick={unknown ? () => setAsking(true) : send}>
          {t('inboxSend.again.button')}
        </Button>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
