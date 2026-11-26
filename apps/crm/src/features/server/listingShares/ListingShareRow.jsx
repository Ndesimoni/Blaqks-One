import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

const TONES = { pending: 'amber', accepted: 'green', declined: 'red', expired: 'red' };

/**
 * One listing share in Agreements → Listings: its reference and label, "From …" or "To …"
 * with the other company, its status and the date that matters now. Opens the share.
 */
export function ListingShareRow({ share, onOpen }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const sent = share.side === 'sender';
  const other = sent ? share.to : share.from;
  const name = other.name || k('someone');
  const waiting = share.allowed.accept;
  const when =
    share.status === 'pending'
      ? k('row.offerEnds', { date: format.date(share.offerEndsAt) })
      : share.status === 'accepted'
        ? k('row.viewEnds', { date: format.date(share.viewEndsAt) })
        : k('row.closed', { date: format.date(share.closedAt || share.decidedAt) });
  return (
    <li>
      <button type="button" className="agreement-row listing-share-row" onClick={onOpen}>
        <span className="agreement-row-main">
          <span className="agreement-row-kind">{share.reference}</span>
          <strong>{share.label}</strong>
          <span className="agreement-row-sub">
            {k(sent ? 'row.to' : 'row.from', {
              name,
              company: other.company || k('otherCompany'),
            })}
          </span>
        </span>
        <span className="agreement-row-status">
          <Badge tone={TONES[share.status] || 'slate'}>{k(`status.${share.status}`)}</Badge>
          <small className={waiting ? 'is-urgent' : ''}>
            {waiting ? k('row.yourAnswer') : when}
          </small>
        </span>
        <Icon name="chevron" size={16} />
      </button>
    </li>
  );
}
