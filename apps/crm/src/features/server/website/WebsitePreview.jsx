import React from 'react';

/**
 * A live sketch of the homepage beside the editor (approved mockup): the site's name, its hero
 * title and subtitle in the chosen theme, from the form as typed. Nothing here is published;
 * Review shows the full content before publishing.
 */
export function WebsitePreview({ form, platform, t }) {
  const title = form.content?.heroTitle?.trim() || t('websites.previewTitle');
  const subtitle = form.content?.heroSubtitle?.trim() || t('websites.previewSubtitle');
  return (
    <aside className="website-preview" aria-label={t('websites.preview')}>
      <div className="website-preview-head">
        <span>{t('websites.preview')}</span>
        <span>{t(`websites.theme${form.theme}`)}</span>
      </div>
      <div className={`website-preview-page website-theme-${form.theme}`}>
        <div className="website-preview-nav">
          {!platform && <b aria-hidden="true">{form.company?.mark || 'CO'}</b>}
          <span>{form.name.trim() || t('websites.previewName')}</span>
        </div>
        <div className="website-sample-hero website-preview-hero">
          <strong>{title}</strong>
          <span>{subtitle}</span>
          <i aria-hidden="true" />
        </div>
      </div>
      <p className="website-preview-note">{t('websites.previewNote')}</p>
    </aside>
  );
}
