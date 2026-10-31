import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The profile facts, worded once for the member's own card, the preview dialog and the join
 * review, in the shared review grid. `head` adds rows before them (such as the name).
 */
export function MarketplaceFacts({ profile, head = [] }) {
  const { t, format } = useI18n();
  const rows = [
    ...head,
    [
      t('marketplaceJoin.profile.emirates'),
      profile.emirates.map((name) => t(`marketplaceJoin.emirate.${name}`)).join(', '),
    ],
    [
      t('marketplaceJoin.profile.communities'),
      profile.communities.length ? profile.communities.join(', ') : t('marketplaceJoin.join.none'),
    ],
    [
      t('marketplaceJoin.profile.propertyTypes'),
      profile.propertyTypes.map((name) => t(`marketplaceJoin.type.${name}`)).join(', '),
    ],
    [
      t('marketplaceJoin.profile.experience'),
      t('marketplaceJoin.mine.years', { years: profile.experienceYears }),
    ],
    ...(profile.licence
      ? [
          [
            t('marketplaceJoin.profile.licence'),
            `${profile.licence.number} · ${t(`marketplaceJoin.authority.${profile.licence.authority}`)}`,
          ],
        ]
      : []),
    [t('marketplaceJoin.profile.joined'), format.date(profile.joinedAt) || profile.joinedAt],
  ];
  return (
    <>
      <dl className="record-review-grid market-review">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="market-hint">{t('marketplaceJoin.mine.declared')}</p>
    </>
  );
}
