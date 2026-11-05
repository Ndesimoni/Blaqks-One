import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import {
  ListingActions,
  ListingDate,
  ListingPrice,
  ListingStatus,
  ListingTitle,
} from './ListingParts.jsx';
import './website-listings-table.css';

/**
 * Desktop rows: a native table with column headers and the listing title as row header. The
 * title opens the CRM property, so the Actions column keeps Republish and Withdraw on one line.
 */
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
                <th scope="row">
                  <div className="website-listing-title">
                    <ListingTitle row={row} busy={actions.busy} onOpen={actions.onOpen} />
                    {row.area && <small>{row.area}</small>}
                  </div>
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
                  <ListingActions row={row} {...actions} withOpen={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
