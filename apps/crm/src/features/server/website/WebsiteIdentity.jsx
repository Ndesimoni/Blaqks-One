import React from 'react';
import { SettingsSection } from '../profile/SettingsSection.jsx';
import { WebsiteField } from './WebsiteField.jsx';

export function WebsiteIdentity({ editor, platform, t }) {
  const { form, state, change } = editor;
  const field = (name, maxLength, extra = {}) => (
    <WebsiteField
      name={name}
      label={t(`websites.${name}`)}
      value={form[name]}
      onChange={(value) => change(name, value)}
      maxLength={maxLength}
      {...extra}
    />
  );
  return (
    <SettingsSection
      id="website-identity"
      title={t('websites.details')}
      description={t('websites.detailsHint')}
    >
      <div className="panel website-form-card">
        {field('name', 100, { required: true })}
        {platform
          ? field('host', 253, {
              required: true,
              hint: t('websites.hostHint'),
              autoCapitalize: 'none',
              spellCheck: false,
            })
          : !state.site &&
            field('slug', 40, {
              required: true,
              minLength: 3,
              pattern: '[a-z0-9-]{3,40}',
              hint: t('websites.slugHint'),
              autoCapitalize: 'none',
              spellCheck: false,
            })}
        {!platform && (
          <>
            <div className="website-field-pair">
              {['mark', 'area'].map((name) => (
                <WebsiteField
                  key={name}
                  name={name}
                  label={t(`websites.${name}`)}
                  value={form.company[name]}
                  required
                  maxLength={name === 'mark' ? 6 : 80}
                  onChange={(value) => change(name, value, 'company')}
                />
              ))}
            </div>
            <WebsiteField
              name="note"
              label={t('websites.note')}
              value={form.company.note}
              multiline
              maxLength={500}
              onChange={(value) => change('note', value, 'company')}
            />
          </>
        )}
        <div className="website-visibility">
          <label>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => change('active', event.target.checked)}
            />
            <span>{t('websites.active')}</span>
          </label>
          <small>{t(platform ? 'websites.platformActiveHint' : 'websites.activeHint')}</small>
        </div>
      </div>
    </SettingsSection>
  );
}
