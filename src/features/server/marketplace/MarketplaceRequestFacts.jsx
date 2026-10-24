import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/** One request's facts, worded once for a board card and a My requests row (packet MK2). */
export function requestFacts(t, format, request) {
  const bedrooms = () => {
    if (request.bedrooms === null) return t('marketplaceRequests.board.noBedrooms');
    if (request.bedrooms === 0) return t('marketplaceRequests.board.studio');
    return t('marketplaceRequests.board.bedrooms', { count: request.bedrooms });
  };
  return [
    [
      t('marketplaceRequests.post.purpose'),
      t(`marketplaceRequests.board.purpose.${request.purpose}`),
    ],
    [t('marketplaceRequests.post.emirate'), t(`marketplaceJoin.emirate.${request.emirate}`)],
    [
      t('marketplaceRequests.post.communities'),
      request.communities.length ? request.communities.join(', ') : t('marketplaceJoin.join.none'),
    ],
    [t('marketplaceRequests.post.propertyType'), request.propertyType],
    [t('marketplaceRequests.post.bedrooms'), bedrooms()],
    [t('marketplaceRequests.post.ready'), t(`marketplaceRequests.board.ready.${request.ready}`)],
    [
      t('marketplaceRequests.post.furnishing'),
      t(`marketplaceRequests.board.furnishing.${request.furnishing}`),
    ],
    [
      t('marketplaceRequests.post.buildingAge'),
      t(`marketplaceRequests.board.age.${request.buildingAge}`),
    ],
    ...(request.cheques
      ? [
          [
            t('marketplaceRequests.post.cheques'),
            t('marketplaceRequests.board.cheques', { count: request.cheques }),
          ],
        ]
      : []),
    ...(request.moveIn
      ? [
          [
            t('marketplaceRequests.post.moveIn'),
            t('marketplaceRequests.board.moveIn', { month: request.moveIn }),
          ],
        ]
      : []),
    [
      t('marketplaceRequests.post.budgetLabel'),
      t(`marketplaceRequests.band.${request.budgetBand}`),
    ],
    [t('marketplaceRequests.mine.ends'), format.date(request.expiresAt) || request.expiresAt],
  ];
}

export function MarketplaceRequestFacts({ request }) {
  const { t, format } = useI18n();
  return (
    <dl className="record-review-grid market-review">
      {requestFacts(t, format, request).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
