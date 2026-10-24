import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { bandFor } from './requestOptions.js';

/** The request the member is about to post, as the board will show it (packet MK2). */
export function MarketplaceRequestReview({ draft }) {
  const { t } = useI18n();
  const maximum = Number(String(draft.budgetMaxAed).replace(/[^0-9]/g, ''));
  const band = bandFor(draft.purpose, maximum);
  const communities = draft.communities
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);
  const rows = [
    [
      t('marketplaceRequests.post.purpose'),
      t(`marketplaceRequests.board.purpose.${draft.purpose}`),
    ],
    [t('marketplaceRequests.post.emirate'), t(`marketplaceJoin.emirate.${draft.emirate}`)],
    [
      t('marketplaceRequests.post.communities'),
      communities.length ? communities.join(', ') : t('marketplaceJoin.join.none'),
    ],
    [t('marketplaceRequests.post.propertyType'), draft.propertyType],
    [
      t('marketplaceRequests.post.bedrooms'),
      draft.bedrooms === ''
        ? t('marketplaceRequests.board.noBedrooms')
        : draft.bedrooms === '0'
          ? t('marketplaceRequests.board.studio')
          : t('marketplaceRequests.board.bedrooms', { count: draft.bedrooms }),
    ],
    [t('marketplaceRequests.post.budgetLabel'), band ? t(`marketplaceRequests.band.${band}`) : '—'],
    [t('marketplaceRequests.post.ready'), t(`marketplaceRequests.board.ready.${draft.ready}`)],
    [
      t('marketplaceRequests.post.furnishing'),
      t(`marketplaceRequests.board.furnishing.${draft.furnishing}`),
    ],
    [
      t('marketplaceRequests.post.buildingAge'),
      t(`marketplaceRequests.board.age.${draft.buildingAge}`),
    ],
  ];
  return (
    <dl className="record-review-grid market-review">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
