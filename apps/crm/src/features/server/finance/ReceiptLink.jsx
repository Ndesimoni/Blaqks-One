import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { receiptHost } from './entryFilters.js';

/**
 * An expense's receipt link (finance-design §13 L-F5): https only, opened in a new tab without
 * an opener or referrer, and labelled with its host so the destination is clear before
 * following it. Anything else renders as plain "No receipt link".
 */
export function ReceiptLink({ url }) {
  const host = url ? receiptHost(url) : null;
  if (!host) return <span className="finance-hint">No receipt link</span>;
  return (
    <a className="finance-receipt" href={url} target="_blank" rel="noopener noreferrer">
      <span>Open receipt</span>
      <small>{host}</small>
      <Icon name="external" size={14} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
