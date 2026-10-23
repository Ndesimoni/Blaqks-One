import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Facts } from '../agreements/AgreementTerms.jsx';

/**
 * Who shared the listing with whom, and when (record sharing R2): the status, the offer and
 * view ends, the note and, for the agent while the share is open, the sender's work phone
 * and email (there is no chat between companies yet) and the "Shared by" badge.
 */
export function ListingShareSummary({ share }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const who = (person) => `${person.name || k('someone')} · ${person.company || k('otherCompany')}`;
  const open = share.viewer === 'agent' && share.status === 'accepted';
  const ended =
    share.status === 'ended' && share.endReason ? k(`endReason.${share.endReason}`) : null;
  const rows = [
    [k('fact.reference'), share.reference],
    [
      k('fact.status'),
      ended ? `${k(`status.${share.status}`)} · ${ended}` : k(`status.${share.status}`),
    ],
    [k('fact.from'), who(share.from)],
    [k('fact.to'), who(share.to)],
    [k('fact.sent'), format.dateTime(share.createdAt)],
    ...(share.offerEndsAt ? [[k('fact.offerEnds'), format.dateTime(share.offerEndsAt)]] : []),
    [k('fact.viewEnds'), format.date(share.viewEndsAt)],
    ...(share.decidedAt ? [[k('fact.decided'), format.dateTime(share.decidedAt)]] : []),
    ...(share.closedAt ? [[k('fact.closed'), format.dateTime(share.closedAt)]] : []),
    [k('fact.exactLocation'), share.exactLocation ? k('yes') : k('no')],
    ...(share.declinedAsKnown ? [[k('fact.declinedAsKnown'), k('yes')]] : []),
    ...(share.note ? [[k('fact.note'), share.note, true]] : []),
    ...(share.from.phone ? [[k('fact.phone'), share.from.phone]] : []),
    ...(share.from.email ? [[k('fact.email'), share.from.email]] : []),
  ];
  return (
    <>
      {open && (
        <p className="outside-share-badge">
          <span className="demo-pill view-only-chip">
            <span /> {k('viewOnly')}
          </span>
          {k('badge', {
            name: share.from.name || k('someone'),
            company: share.from.company || k('otherCompany'),
            date: format.date(share.createdAt),
            until: format.date(share.viewEndsAt),
          })}
        </p>
      )}
      <Facts title={k('summaryTitle')} rows={rows} />
    </>
  );
}
