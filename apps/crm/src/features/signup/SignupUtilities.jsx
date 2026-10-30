import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { usePreferences } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';

export function SignupUtilities() {
  const { settings, setSettings } = usePreferences();
  const { language, languages, setLanguage, t } = useI18n();
  const dark = settings.theme === 'dark';
  return (
    <div className="signup-utilities">
      {languages.length > 1 && (
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
      )}
      <button
        type="button"
        className="theme-switch"
        aria-label={dark ? t('signup.themeLight') : t('signup.themeDark')}
        onClick={() => setSettings((value) => ({ ...value, theme: dark ? 'light' : 'dark' }))}
      >
        <Icon name={dark ? 'sun' : 'moon'} size={18} />
        <span>{dark ? t('signup.light') : t('signup.dark')}</span>
      </button>
    </div>
  );
}
