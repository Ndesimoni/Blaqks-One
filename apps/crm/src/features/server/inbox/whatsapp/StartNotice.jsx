import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useNavigation } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { startRefusalKey } from './whatsappCodes.js';

/**
 * Why Start message on WhatsApp cannot send yet, in plain words, with the next step: Record
 * agreement when that is all that is missing, Restore agreement for the Admin after a STOP,
 * and Channels for the Admin when their number or the company account needs attention.
 */
export function StartNotice({ refusal, user, onAgreement }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const admin = user.roleId === 'admin';
  const key =
    refusal === 'no_number' && admin ? 'refusal.no_numberAdmin' : startRefusalKey(refusal);
  return (
    <div className="inbox-reply-notice wa-template-notice" role="status">
      <span>{t(`whatsappStart.${key}`)}</span>
      {refusal === 'no_agreement' && (
        <Button onClick={onAgreement}>{t('whatsappSend.agreement.record')}</Button>
      )}
      {refusal === 'opted_out' && admin && (
        <Button variant="light" onClick={onAgreement}>
          {t('whatsappSend.agreement.restore')}
        </Button>
      )}
      {admin && ['no_number', 'account_reconnect'].includes(refusal) && (
        <Button variant="light" onClick={() => navigate('Channels')}>
          {t('whatsappStart.openChannels')}
        </Button>
      )}
    </div>
  );
}
