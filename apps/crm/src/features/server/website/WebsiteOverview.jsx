import React from 'react';
import { websiteStatus } from './websiteModel.js';

export function WebsiteOverview({ state, dirty, platform, t }) {
  const site = state.site;
  const status = websiteStatus(site, platform);
  return (
    <section className="website-overview" aria-labelledby="website-overview-title">
      <div className="website-intro">
        <p className="website-eyebrow">{t('websites.overview')}</p>
        <h2 id="website-overview-title">
          {t(platform ? 'websites.platformIntro' : 'websites.companyIntro')}
        </h2>
        <p>{t('websites.introText')}</p>
      </div>
      <div className="website-summary-grid">
        <div>
          <span className="website-status">{t(`websites.${status}`)}</span>
          <p>{t(`websites.${status}Hint`)}</p>
          <div className="website-state-line">
            {site && <strong>{t('websites.liveVersion', { version: site.version })}</strong>}
            <span>
              {state.draft
                ? t('websites.draftVersion', { version: state.version })
                : t('websites.noDraft')}
            </span>
            {dirty && <span className="website-status">{t('websites.unsaved')}</span>}
          </div>
        </div>
        <div className="website-address">
          <span>{t('websites.publicAddress')}</span>
          <strong>{site?.host || '—'}</strong>
          <small>{t('websites.addressHint')}</small>
          {!platform && site && (
            <small>
              {t(site.licenceVerified ? 'websites.listingEligible' : 'websites.listingNotEligible')}
            </small>
          )}
        </div>
      </div>
    </section>
  );
}
