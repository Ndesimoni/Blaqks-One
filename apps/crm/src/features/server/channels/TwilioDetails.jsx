import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The Twilio account's health in plain words: the masked Account SID, when the Auth Token
 * was saved, and what to do when Twilio stopped accepting it. The token is never shown.
 */
export function TwilioDetails({ connection }) {
  const { t, format } = useI18n();
  const hint = String(connection.accountHint ?? '').replace(/^[^0-9a-zA-Z]*/, '');
  const saved = connection.credentialUpdatedAt && format.date(connection.credentialUpdatedAt);
  return (
    <>
      <small>{t('whatsappAccount.account', { hint })}</small>
      {saved && <small>{t('whatsappAccount.tokenSaved', { date: saved })}</small>}
      {connection.state === 'reconnect_required' && (
        <p className="channel-attention" role="status">
          {t('whatsappAccount.attention')}
        </p>
      )}
    </>
  );
}
