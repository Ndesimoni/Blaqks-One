import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ListingActions, ListingDate, ListingPrice, ListingStatus } from './ListingParts.jsx';

/** Phone layout: one card per listing with the same facts and actions as the table. */
export function ListingCards({ rows, agentName, actions }) {
  const { t } = useI18n();
  const k = (key) => t(`websiteListings.${key}`);
  return (
    <ul className="website-listing-cards" aria-label={k('tableLabel')}>
      {rows.map((row) => (
        <li
          key={row.publication.id}
          className="website-listing-card"
          data-publication-id={row.publication.id}
        >
          <div className="website-listing-card-head">
            <div className="website-listing-title">
              <h3>{row.title}</h3>
              {row.area && <small>{row.area}</small>}
            </div>
            <ListingStatus status={row.status} />
          </div>
          <dl className="website-listing-facts">
            <div>
              <dt>{k('colPrice')}</dt>
              <dd className="website-listing-price">
                <ListingPrice purpose={row.purpose} price={row.price} />
              </dd>
            </div>
            <div>
              <dt>{k('colAgent')}</dt>
              <dd>{agentName(row)}</dd>
            </div>
            <div>
              <dt>{k('colPublished')}</dt>
              <dd>
                <ListingDate value={row.publishedAt} />
              </dd>
            </div>
          </dl>
          <ListingActions row={row} {...actions} />
        </li>
      ))}
    </ul>
  );
}
