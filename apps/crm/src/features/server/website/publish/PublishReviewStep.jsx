import React, { useId } from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { useMediaSource } from '../../../../lib/mediaSource.js';
import { Facts } from '../../agreements/AgreementTerms.jsx';
import { priceKey } from '../listings/listingsModel.js';
import { photoChoices, profileName } from './publishModel.js';
import { PRIVATE_FACTS, publicFacts } from './publishView.js';
import '../../agreements/agreement-terms.css';
import './website-publish-review.css';

/**
 * The last step keeps the two sides apart: "What visitors will see" (eye icon, the public
 * facts and selected photos, as ListingView shows a listing) and "Stays private" (lock icon,
 * named in words), side by side on wide screens. The note that publishing is immediate (later
 * edits stay private until republished) comes first, so it is read before Publish now.
 */
export function PublishReviewStep({ flow, publishers }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const source = useMediaSource();
  const id = useId();
  const { draft } = flow;
  const record = flow.entry.record;
  const facts = publicFacts(record);
  const agent = publishers.profiles.find((profile) => profile.id === draft.agentProfileId);
  const photos = draft.photos
    .map((file) => photoChoices(record).find((photo) => photo.file === file))
    .filter(Boolean);
  const amount = format.number(facts.price, { maximumFractionDigits: 0 });
  const rows = [
    [k('fact.title'), facts.title, true],
    [k('fact.purpose'), facts.purpose && k(`purpose.${facts.purpose}`)],
    [k('fact.type'), facts.type],
    [k('fact.location'), facts.location],
    [k('fact.bedrooms'), facts.studio ? k('studio') : facts.bedrooms],
    [k('fact.bathrooms'), facts.bathrooms],
    [k('fact.size'), k('sqft', { size: format.number(facts.size) })],
    [k('fact.price'), t(`websiteListings.${priceKey(facts.purpose)}`, { amount })],
    [k('fact.ready'), facts.ready],
    [k('fact.furnishing'), facts.furnishing],
    [k('fact.parking'), facts.parking],
    [k('fact.amenities'), facts.amenities],
    [k('fact.guests'), facts.guests],
    [k('fact.minimumStay'), facts.minimumStay],
    [k('fact.permit'), draft.permit.trim()],
    facts.purpose === 'buy' && [k('fact.market'), k(`market.${draft.market || 'none'}`)],
    [k('fact.agent'), profileName(agent)],
    [
      k('fact.destination'),
      k(draft.destination === 'company_only' ? 'destinationCompany' : 'destinationBoth'),
    ],
    [k('fact.media'), k('mediaCount', { photos: photos.length, plans: draft.floorPlans.length })],
    [k('fact.description'), facts.description, true],
  ].filter((row) => row && row[1] !== '' && row[1] !== null && row[1] !== undefined);
  return (
    <div className="website-review-split">
      <p className="website-publish-note website-review-note" role="note">
        {k('immediateNote')}
      </p>
      <section className="website-review-public" aria-labelledby={`${id}-public`}>
        <p className="website-review-eyebrow">
          <Icon name="eye" size={16} />
          {k('publicEyebrow')}
        </p>
        <h4 id={`${id}-public`}>{k('publicTitle')}</h4>
        {photos.length > 0 && (
          <ul className="website-review-photos" aria-label={k('publicPhotos')}>
            {photos.map((photo, index) => (
              <li key={photo.file}>
                <img
                  src={source.src(photo, record)}
                  alt={k(index === 0 ? 'reviewCover' : 'reviewPhoto', { number: index + 1 })}
                  loading="lazy"
                />
                {index === 0 && <span className="website-photo-mark">{k('cover')}</span>}
              </li>
            ))}
          </ul>
        )}
        <Facts title={k('publicFacts')} rows={rows} />
      </section>
      <section className="website-review-private" aria-labelledby={`${id}-private`}>
        <p className="website-review-eyebrow">
          <Icon name="lock" size={16} />
          {k('privateEyebrow')}
        </p>
        <h4 id={`${id}-private`}>{k('privateTitle')}</h4>
        <ul>
          {PRIVATE_FACTS.map((key) => (
            <li key={key}>{k(`private.${key}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
