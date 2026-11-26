import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from './listingShareLinks.js';

/**
 * The server's preview (exported-content policy as built, R2 review amendment 5): exactly
 * what the agent sees before accepting (twelve facts, no photos) and after (the listing
 * as sent, with its photos and floor plans under neutral names). Free text and links go as
 * written, so contact-like text, links and a contact-like note must be checked and confirmed
 * before Send (`needsConfirm`, see shareChecks.js).
 */
export function OutsideShareReview({ review, needsConfirm, noteWarning, confirmed, onConfirm }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShares.${key}`, vars);
  const noFiles = () => null;
  const files = [...review.photos, ...review.floorPlans];
  return (
    <div className="outside-share-review">
      {(review.warnings.length > 0 || noteWarning) && (
        <ul className="outside-share-warnings" aria-label={k('warningsLabel')}>
          {review.warnings.map((code) => (
            <li key={code}>{k(`warning.${code}`)}</li>
          ))}
          {noteWarning && <li>{k('warning.noteContact')}</li>}
        </ul>
      )}
      <section aria-label={k('beforeTitle')}>
        <h3>{k('beforeTitle')}</h3>
        <ListingView property={toProperty(review.before)} file={noFiles} />
      </section>
      <details className="outside-share-after">
        <summary>{k('afterTitle')}</summary>
        <ListingView property={toProperty(review.after)} file={noFiles} />
      </details>
      <p className="outside-share-files">
        {files.length
          ? k('filesSent', { photos: review.photos.length, plans: review.floorPlans.length })
          : k('noFiles')}
      </p>
      {needsConfirm && (
        <label className="outside-share-check outside-share-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirm(event.target.checked)}
          />
          <span>{k('confirmChecked')}</span>
        </label>
      )}
    </div>
  );
}
