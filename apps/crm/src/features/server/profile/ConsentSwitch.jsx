import React from 'react';

/**
 * The website consent as the approved mockup's switch row: "I agree to appear on the website",
 * with what that shows and that only the member gives or withdraws it.
 */
export function ConsentSwitch({ checked, disabled, onChange, t }) {
  return (
    <div className="profile-switch-row">
      <span>
        <strong id="wp-consent-title">{t('websiteTeam.own.consentTitle')}</strong>
        <span className="acct-muted" id="wp-consent-text">
          {t('websiteTeam.own.consent')}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="profile-switch"
        aria-labelledby="wp-consent-title"
        aria-describedby="wp-consent-text"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
