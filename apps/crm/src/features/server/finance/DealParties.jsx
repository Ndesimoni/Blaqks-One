import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMediaSource } from '../../../lib/mediaSource.js';
import { findEntry } from '../assignment/assignmentModel.js';
import { withKept } from '../keptRecords.js';
import { Fact } from './EntryFacts.jsx';
import './handover-listing.css';
import './deal-parties.css';

const PHOTOS = 3;

/**
 * The deal's client and listing as the caller can read them now (H3b, owner 2026-10-23:
 * "contact right after accepting", "all listing details"). After a hand-over is accepted
 * both belong to the receiver, so the deal shows the client's phone and email and the
 * listing's main facts and photos at once, with Open client and Open listing for the rest.
 * Read live from the caller's own records (or view-only copies), never from the agreement
 * evidence, which holds no contact.
 */
export function DealParties({ deal }) {
  const { entries, keptEntries } = useRecords();
  const { dispatchRow } = useWorkspaceActions();
  const media = useMediaSource();
  const { t } = useI18n();
  const k = (key, vars) => t(`dealParties.${key}`, vars);
  const titleId = useId();
  const sources = withKept(entries || {}, keptEntries, ['Clients', 'Properties']);
  const find = (collection, key, id) => (id ? findEntry(sources, collection, { [key]: id }) : null);
  const client = find('Clients', 'client_id', deal.clientId);
  const listing = find('Properties', 'property_id', deal.propertyId);
  if (!client && !listing) return null;
  const person = client?.record;
  const place = listing?.record;
  const photos = (place?.media_photos || []).filter((photo) => media.src(photo, place));
  const facts = [place?.community, place?.bedrooms && `${place.bedrooms} BR`]
    .concat(place?.price_annual_rent_aed ? [`AED ${place.price_annual_rent_aed}`] : [])
    .filter(Boolean);
  return (
    <section className="finance-detail-section deal-parties" aria-labelledby={titleId}>
      <h3 id={titleId}>{k('title')}</h3>
      {person && (
        <div className="deal-party">
          <dl className="finance-facts">
            <Fact label={k('client')}>{`${person.full_name || ''} (${deal.clientId})`}</Fact>
            <Fact label={k('phone')}>
              {person.phone && <a href={`tel:${person.phone}`}>{person.phone}</a>}
            </Fact>
            <Fact label={k('email')}>
              {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
            </Fact>
          </dl>
          {!person.phone && !person.email && <p className="finance-hint">{k('noContact')}</p>}
          <Button
            variant="light"
            aria-label={k('openClientLabel', { id: deal.clientId })}
            onClick={() => dispatchRow('Clients', person)}
          >
            {k('openClient')}
          </Button>
        </div>
      )}
      {place && (
        <div className="deal-party">
          <dl className="finance-facts">
            <Fact label={k('listing')}>{`${place.listing_title || ''} (${deal.propertyId})`}</Fact>
          </dl>
          {facts.length > 0 && <p className="deal-party-facts">{facts.join(' · ')}</p>}
          {photos.length ? (
            <ul className="handover-photo-list deal-party-photos">
              {photos.slice(0, PHOTOS).map((photo, index) => (
                <li key={photo.file || index}>
                  <img
                    src={media.src(photo, place)}
                    alt={k('photoAlt', { number: index + 1, title: place.listing_title || '' })}
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-hint">{k('noPhotos')}</p>
          )}
          <Button
            variant="light"
            aria-label={k('openListingLabel', { id: deal.propertyId })}
            onClick={() => dispatchRow('Properties', place)}
          >
            {k('openListing')}
          </Button>
        </div>
      )}
    </section>
  );
}
