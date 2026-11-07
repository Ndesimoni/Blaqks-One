import React from 'react';
import { WebsiteActions } from './WebsiteActions.jsx';
import { websiteStatus } from './websiteModel.js';

/**
 * The publish bar (NAV, approved mockup): where the site stands (status, live and draft
 * versions, unsaved changes, public address) beside its actions, at the top of Content. The
 * submit actions reach the editor below through its form id.
 */
export function WebsitePublishBar({ editor, platform, form, onReview, t }) {
  const { state, dirty } = editor;
  const site = state.site;
  const status = websiteStatus(site, platform);
  return (
    <section className="website-publish-bar" aria-labelledby="website-publish-title">
      <div className="website-publish-state">
        <h2 id="website-publish-title" className="sr-only">
          {t('websites.overview')}
        </h2>
        <div className="website-state-line">
          <span className="website-status">{t(`websites.${status}`)}</span>
          {site && <strong>{t('websites.liveVersion', { version: site.version })}</strong>}
          <span>
            {state.draft
              ? t('websites.draftVersion', { version: state.version })
              : t('websites.noDraft')}
          </span>
          {dirty && <span className="website-status">{t('websites.unsaved')}</span>}
        </div>
        <p>
          {t(`websites.${status}Hint`)}{' '}
          <span className="website-host">
            {t('websites.publicAddress')}: <strong>{site?.host || '—'}</strong>
          </span>
        </p>
        {!platform && site && (
          <p>
            {t(site.licenceVerified ? 'websites.listingEligible' : 'websites.listingNotEligible')}
          </p>
        )}
      </div>
      <WebsiteActions editor={editor} form={form} onReview={onReview} t={t} />
    </section>
  );
}
