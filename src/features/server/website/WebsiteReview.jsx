import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { CONTENT_KEYS } from './websiteModel.js';

export function WebsiteReview({ form, dirty, saved, published, platform, onClose, t }) {
  return (
    <Drawer titleId="website-review-title" onClose={onClose} className="website-review" size="wide">
      <header className="drawer-header">
        <div>
          <h2 id="website-review-title">{t('websites.reviewTitle')}</h2>
          <p>{t('websites.reviewHint')}</p>
        </div>
        <Button
          variant="light"
          icon="close"
          onClick={onClose}
          data-initial-focus
          aria-label={t('websites.closeReview')}
        />
      </header>
      <div className="drawer-body">
        <p className="website-status">
          {t(
            dirty || (!saved && !published)
              ? 'websites.reviewUnsaved'
              : saved
                ? 'websites.reviewSaved'
                : 'websites.reviewPublished',
          )}
        </p>
        <div className="website-review-heading">
          <span>{t(`websites.theme${form.theme}`)}</span>
          <h3>{form.name || t('websites.name')}</h3>
          {!platform && <p>{form.company.area}</p>}
          <p>{form.content.heroTitle || t('websites.reviewEmpty')}</p>
        </div>
        <dl className="website-review-fields">
          {!platform && (
            <>
              <dt>{t('websites.note')}</dt>
              <dd>{form.company.note || t('websites.reviewEmpty')}</dd>
            </>
          )}
          {CONTENT_KEYS.map((key) => (
            <React.Fragment key={key}>
              <dt>
                {t(platform && key === 'about' ? 'websites.platformAbout' : `websites.${key}`)}
              </dt>
              <dd>{form.content[key] || t('websites.reviewEmpty')}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
      <footer className="drawer-footer">
        <Button variant="light" onClick={onClose}>
          {t('websites.closeReview')}
        </Button>
      </footer>
    </Drawer>
  );
}
