import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Icon } from '../../../components/ui/Icon.jsx';
import { parseAed } from '../../../lib/finance/money.js';
import { safeExternalUrl } from '../../../lib/validation.js';
import { Facts } from '../agreements/AgreementTerms.jsx';
import { listingDetailKeys, propertyFactKeys } from './handoverPreviewModel.js';
import { useFinanceContext } from './useFinanceRequests.js';
import './handover-listing.css';

const LONG = ['address', 'amenities', 'description', 'keySellingPoints'];
const LINKS = ['mapLink', 'listingUrl', 'virtualTourUrl', 'floorPlanUrl'];

/** A link field opens externally only when it is a safe web address; otherwise it is text. */
function Link({ value }) {
  const href = safeExternalUrl(value);
  if (!href) return value;
  return (
    <a className="detail-link" href={href} target="_blank" rel="noopener noreferrer">
      {value}
      <Icon name="external" size={14} />
    </a>
  );
}

/**
 * The listing in a hand-over review (agreements design §18): the main facts always, the
 * rest of the listing when recorded, and its stored photos and floor plans, which load
 * through the review's own file route. Never the owner's name or phone.
 */
export function HandoverListing({ property, handoverId }) {
  const { t, format } = useI18n();
  const { workspaceId } = useFinanceContext();
  const k = (key, vars) => t(`handoverReview.${key}`, vars);
  const known = (value, show = (v) => v) => (value === null ? k('notRecorded') : show(value));
  const price = (value) => {
    const parsed = parseAed(value);
    return parsed.error || parsed.value === null ? value : format.money(parsed.value);
  };
  const shown = { sizeSqft: (size) => k('property.sqft', { size }), priceAed: price };
  const file = (id) =>
    `/api/crm/workspaces/${encodeURIComponent(workspaceId)}/finance/handovers/${encodeURIComponent(handoverId)}/preview/files/${encodeURIComponent(id)}`;
  const details = listingDetailKeys
    .filter((key) => property[key] !== null)
    .map((key) => [
      k(`property.${key}`),
      LINKS.includes(key) ? <Link value={property[key]} /> : property[key],
      LONG.includes(key),
    ]);
  return (
    <>
      <Facts
        title={k('property.title')}
        rows={[
          ...propertyFactKeys.map((key) => [
            k(`property.${key}`),
            known(property[key], shown[key]),
            key === 'listingTitle',
          ]),
          ...details,
        ]}
      />
      {property.photos.length > 0 && (
        <section className="agreement-facts handover-photos">
          <h3>{k('property.photos')}</h3>
          <ul className="handover-photo-list">
            {property.photos.map((photo) => (
              <li key={photo.file}>
                <a href={file(photo.file)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={file(photo.thumb || photo.file)}
                    alt={k('property.photoAlt', { name: photo.name })}
                    loading="lazy"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {property.floorPlans.length > 0 && (
        <Facts
          title={k('property.floorPlans')}
          rows={property.floorPlans.map((plan) => [
            plan.name || k('property.floorPlans'),
            <a
              key={plan.file}
              className="detail-link"
              href={file(plan.file)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {k('property.openFile', { name: plan.name || k('property.floorPlans') })}
              <Icon name="external" size={14} />
            </a>,
          ])}
        />
      )}
    </>
  );
}
