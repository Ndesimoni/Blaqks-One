import React from 'react';
import { SettingsSection } from '../profile/SettingsSection.jsx';
import { THEMES } from './websiteModel.js';

export function WebsiteThemes({ value, onChange, t }) {
  return (
    <SettingsSection
      id="website-theme"
      title={t('websites.design')}
      description={t('websites.themeHint')}
    >
      <fieldset className="website-theme-list" aria-describedby="website-theme-hint">
        <legend className="sr-only">{t('websites.theme')}</legend>
        <span className="sr-only" id="website-theme-hint">
          {t('websites.themeHint')}
        </span>
        {THEMES.map((theme) => (
          <label
            key={theme}
            className={`website-theme-option ${value === theme ? 'is-selected' : ''}`}
          >
            <input
              type="radio"
              name="website-theme"
              value={theme}
              checked={value === theme}
              onChange={() => onChange(theme)}
              aria-label={t(`websites.theme${theme}`)}
            />
            <span className={`website-theme-sample website-theme-${theme}`} aria-hidden="true">
              <span className="website-sample-nav" />
              <span className="website-sample-hero">
                <i />
                <i />
              </span>
              <span className="website-sample-list">
                <i />
                <i />
                <i />
              </span>
            </span>
            <strong>{t(`websites.theme${theme}`)}</strong>
            <small>{t(`websites.theme${theme}Note`)}</small>
          </label>
        ))}
      </fieldset>
    </SettingsSection>
  );
}
