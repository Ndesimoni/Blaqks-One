import React from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { consentKey, windowLabel } from './whatsappModel.js';

const CONSENT_ICON = { opt_in: 'check', opt_out: 'close', none: 'info' };

/**
 * One quiet line above the WhatsApp composer: the 24-hour window (only where the member may
 * send), the client's agreement, then the switch between a message and a template and the
 * Agreement panel's toggle. The agreement is announced when it changes.
 */
export function WhatsappStatus({
  whatsapp,
  panelId,
  agreementOpen,
  onAgreement,
  switchTo,
  onSwitch,
}) {
  const { t, format } = useI18n();
  const window = windowLabel(whatsapp.window);
  const state = whatsapp.consent?.state || 'none';
  return (
    <div className="wa-status">
      {whatsapp.canSend && (
        <span className={'wa-chip' + (window.at ? ' is-open' : ' is-closed')}>
          <Icon name="clock" size={14} aria-hidden="true" />
          <span>
            {t(`whatsappSend.${window.key}`, { time: window.at ? format.time(window.at) : '' })}
          </span>
        </span>
      )}
      <span className={`wa-chip wa-consent is-${state}`} aria-live="polite">
        <Icon name={CONSENT_ICON[state] || 'info'} size={14} aria-hidden="true" />
        <span>{t(`whatsappSend.${consentKey(whatsapp.consent)}`)}</span>
      </span>
      <span className="wa-status-actions">
        {switchTo && (
          <button type="button" className="wa-link" onClick={onSwitch}>
            {t(`whatsappSend.mode.${switchTo}`)}
          </button>
        )}
        <button
          type="button"
          className={'wa-link' + (agreementOpen ? ' is-open' : '')}
          aria-expanded={agreementOpen}
          aria-controls={agreementOpen ? panelId : undefined}
          onClick={onAgreement}
        >
          {t('whatsappSend.agreement.open')}
        </button>
      </span>
    </div>
  );
}
