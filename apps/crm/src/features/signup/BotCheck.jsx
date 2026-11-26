import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import './turnstile.css';
import { useTurnstile } from './useTurnstile.js';

function Turnstile({ siteKey, action, onToken, resetKey }) {
  const { t } = useI18n();
  const { container, status } = useTurnstile({ siteKey, action, onToken, resetKey });
  return (
    <div className="signup-turnstile">
      <div ref={container} />
      {status === 'loading' && <p className="signup-bot-note">{t('signup.turnstileLoading')}</p>}
      {status === 'error' && (
        <p className="field-error" role="alert">
          {t('signup.turnstileError')}
        </p>
      )}
    </div>
  );
}

/** Local bypass note, or the explicit Turnstile widget when the server is configured. */
export function BotCheck({ provider, siteKey, action, onToken, resetKey }) {
  const { t } = useI18n();
  if (provider === 'turnstile' && siteKey)
    return <Turnstile siteKey={siteKey} action={action} onToken={onToken} resetKey={resetKey} />;
  if (provider === 'local')
    return (
      <p className="signup-bot-note">
        <Icon name="shield" size={15} /> {t('signup.botLocal')}
      </p>
    );
  return null;
}
