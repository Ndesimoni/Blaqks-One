import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ListingActions, ListingDate, ListingPrice, ListingStatus } from './ListingParts.jsx';

/** Desktop rows: a native table with column headers and the listing title as row header. */
export function ListingsTable({ rows, agentName, actions }) {
  const { t } = useI18n();
  const k = (key) => t(`websiteListings.${key}`);
  return (
    <div className="table-shell website-listings-table-shell">
      <div className="table-scroll">
        <table className="data-table website-listings-table" aria-label={k('tableLabel')}>
          <thead>
            <tr>
              <th scope="col">{k('colListing')}</th>
              <th scope="col">{k('colPrice')}</th>
              <th scope="col">{k('colAgent')}</th>
              <th scope="col">{k('colStatus')}</th>
              <th scope="col">{k('colPublished')}</th>
              <th scope="col">{k('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.publication.id} data-publication-id={row.publication.id}>
                <th scope="row" className="website-listing-title">
                  <strong>{row.title}</strong>
                  {row.area && <small>{row.area}</small>}
                </th>
                <td className="website-listing-price">
                  <ListingPrice purpose={row.purpose} price={row.price} />
                </td>
                <td>{agentName(row)}</td>
                <td>
                  <ListingStatus status={row.status} />
                </td>
                <td>
                  <ListingDate value={row.publishedAt} />
                </td>
                <td>
                  <ListingActions row={row} {...actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
