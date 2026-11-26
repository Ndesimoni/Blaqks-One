import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useNavigation } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { refusalKey } from './whatsappCodes.js';

/**
 * Why this member cannot send in this WhatsApp conversation, in plain words (design §18's
 * refusal order), with the way to fix it where there is one: the Admin opens Channels for
 * the company's Twilio account, or restores agreement after a STOP. A conversation on a
 * colleague's number names them.
 */
export function WhatsappNotice({ whatsapp, user, members, onAgreement }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const admin = user.roleId === 'admin';
  const refusal = whatsapp.refusal;
  const owner = members?.find((member) => member.id === whatsapp.numberOwnerId)?.name;
  const key =
    refusal === 'other_number' && !owner ? 'refusal.other_numberPlain' : refusalKey(refusal);
  return (
    <div className="inbox-reply-notice" role="status">
      <span>{t(`whatsappReasons.${key}`, { owner })}</span>
      {admin && ['account_reconnect', 'no_number'].includes(refusal) && (
        <Button variant="light" onClick={() => navigate('Channels')}>
          {t('whatsappReasons.refusal.openChannels')}
        </Button>
      )}
      {admin && refusal === 'opted_out' && (
        <Button variant="light" onClick={onAgreement}>
          {t('whatsappSend.agreement.restore')}
        </Button>
      )}
    </div>
  );
}

/** Before a template: the client's agreement first, or no approved template yet. */
export function TemplateNotice({ state, onAgreement }) {
  const { t } = useI18n();
  return (
    <div className="inbox-reply-notice wa-template-notice" role="status">
      <span>{t(`whatsappSend.template.${state}`)}</span>
      {state === 'needsAgreement' && (
        <Button onClick={onAgreement}>{t('whatsappSend.agreement.record')}</Button>
      )}
    </div>
  );
}
