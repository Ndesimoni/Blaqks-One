import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';

/**
 * The account pages' language choice, shown only while more than one language is offered.
 * Light or dark is chosen on the website and in the CRM, not here (owner, 2026-11-05).
 */
export function SignupUtilities() {
  const { language, languages, setLanguage, t } = useI18n();
  if (languages.length < 2) return null;
  return (
    <div className="signup-utilities">
      <label>
        <span className="sr-only">{t('signup.languageLabel')}</span>
        <select value={language} onChange={(event) => setLanguage(event.target.value)}>
          {languages.map((code) => (
            <option key={code} value={code}>
              {t(`common.language.name.${code}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
