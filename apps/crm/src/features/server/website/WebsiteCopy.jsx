import React from 'react';
import { SettingsSection } from '../profile/SettingsSection.jsx';
import { WebsiteField } from './WebsiteField.jsx';
import { WebsiteSocial } from './WebsiteSocial.jsx';

/** Website content, then its social links, then search details. */
export function WebsiteCopy({ editor, platform, t }) {
  const { form, change } = editor;
  const field = (key, multiline = false) => (
    <WebsiteField
      key={key}
      name={key}
      label={t(platform && key === 'about' ? 'websites.platformAbout' : `websites.${key}`)}
      value={form.content[key]}
      multiline={multiline}
      maxLength={4000}
      hint={key === 'services' ? t('websites.servicesHint') : undefined}
      onChange={(value) => change(key, value, 'content')}
    />
  );
  return (
    <>
      <SettingsSection
        id="website-copy"
        title={t('websites.content')}
        description={t('websites.contentHint')}
      >
        <div className="panel website-form-card">
          {field('heroTitle')}
          {field('heroSubtitle', true)}
          {field('tagline')}
          {field('about', true)}
          {field('contactText', true)}
          {field('services', true)}
        </div>
      </SettingsSection>
      <WebsiteSocial editor={editor} platform={platform} t={t} />
      <SettingsSection
        id="website-search"
        title={t('websites.seo')}
        description={t('websites.seoHint')}
      >
        <div className="panel website-form-card">
          {field('seoTitle')}
          {field('seoDescription', true)}
        </div>
      </SettingsSection>
    </>
  );
}
