import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * What a share shows in place of the listing. A member who shared it but no longer holds it
 * (R2a security review L7) reads who it was shared with above a blurred placeholder, never
 * the real listing (the server sends none); while the sender is suspended (L6) the other
 * company reads that it isn't available right now; otherwise it is no longer available.
 */
export function ListingShareHidden({ share }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  if (share.viewer !== 'introducer')
    return (
      <p className="outside-share-hidden-note">
        <strong>{k(share.paused ? 'paused' : 'noLongerAvailable')}</strong>
        {share.paused && <span>{k('pausedNote')}</span>}
      </p>
    );
  return (
    <section className="outside-share-hidden" aria-label={k('hiddenLabel')}>
      <p className="outside-share-hidden-note">
        <strong>
          {k('introducerShared', {
            name: share.to.name || k('someone'),
            company: share.to.company || k('otherCompany'),
            date: format.date(share.createdAt),
          })}
        </strong>
        <span>{k('introducerNote')}</span>
      </p>
      <div className="outside-share-blur" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </section>
  );
}
