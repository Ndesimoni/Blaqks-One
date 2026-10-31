import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { LANGUAGES } from '../../../i18n/languages.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useLanguageSave } from './useLanguageSave.js';

function LanguageOption({ code, checked, onChoose }) {
  const { t } = useI18n();
  const { name, dir, preview } = LANGUAGES[code];
  return (
    <label className="lang-option" data-selected={checked || undefined}>
      <input
        type="radio"
        className="lang-radio"
        name="profile-language"
        value={code}
        checked={checked}
        onChange={() => onChoose(code)}
      />
      <span className="lang-option-text">
        <span className="lang-option-name" lang={code}>
          {name}
        </span>
        <span className="lang-option-meta">
          {t(`common.language.name.${code}`)} · {t(`common.language.${dir}`)}
        </span>
      </span>
      {preview && <span className="acct-badge lang-badge">{t('common.language.preview')}</span>}
    </label>
  );
}

/**
 * My profile Language setting (docs/i18n.md): one card per available language, saved to
 * the member's account as soon as it is chosen. Arabic appears only with the preview flag.
 */
export function LanguageSetting({ api, account, onSaved }) {
  const { t, languages } = useI18n();
  const save = useLanguageSave(api, onSaved);
  const saved = account.user.language || 'en';
  const selected = save.status === 'saving' ? save.pending : saved;
  const preview = languages.some((code) => LANGUAGES[code].preview);
  const savedName = t(`common.language.name.${saved}`);
  return (
    <div className="panel acct-card">
      <div className="acct-card-body lang-body">
        <fieldset
          className="lang-options"
          disabled={save.status === 'saving'}
          aria-busy={save.status === 'saving'}
          aria-describedby={preview ? 'profile-language-note' : undefined}
        >
          <legend className="sr-only">{t('profile.language.group')}</legend>
          {languages.map((code) => (
            <LanguageOption
              key={code}
              code={code}
              checked={selected === code}
              onChoose={save.choose}
            />
          ))}
        </fieldset>
        {preview && (
          <p className="lang-note" id="profile-language-note">
            <Icon name="info" size={15} />
            {t('common.language.previewNote')}
          </p>
        )}
        {save.status === 'error' && (
          <div className="acct-alert" role="alert">
            <p className="field-error">{t('profile.language.error')}</p>
            <Button variant="light" onClick={save.retry}>
              {t('common.language.retry')}
            </Button>
          </div>
        )}
        <div className="lang-status" aria-live="polite">
          {save.status === 'saving' && (
            <p className="acct-muted lang-saving">{t('profile.language.saving')}</p>
          )}
          {save.status === 'saved' && (
            <p className="acct-success">
              <Icon name="check" size={15} />
              {t('profile.language.saved', { language: savedName })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
