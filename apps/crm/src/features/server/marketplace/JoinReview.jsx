import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { communityNames, profilePayload } from './joinDraft.js';

/** What the member is about to send, before the last button. */
export function JoinReview({ draft, terms, busy, error, onJoin }) {
  const { t } = useI18n();
  const profile = profilePayload(draft);
  const names = communityNames(draft.communities);
  const rows = [
    [
      t('marketplaceJoin.join.emirates'),
      profile.emirates.map((name) => t(`marketplaceJoin.emirate.${name}`)).join(', '),
    ],
    [
      t('marketplaceJoin.join.propertyTypes'),
      profile.propertyTypes.map((name) => t(`marketplaceJoin.type.${name}`)).join(', '),
    ],
    [
      t('marketplaceJoin.join.communities'),
      names.length ? names.join(', ') : t('marketplaceJoin.join.none'),
    ],
    [
      t('marketplaceJoin.join.experience'),
      t('marketplaceJoin.mine.years', { years: profile.experienceYears }),
    ],
  ];
  if (profile.licence) rows.push([t('marketplaceJoin.join.licenceNumber'), profile.licence.number]);
  rows.push([t('marketplaceJoin.join.termsTitle'), terms.version]);
  return (
    <section className="market-step">
      <h3>{t('marketplaceJoin.join.review')}</h3>
      <dl className="record-review-grid market-review">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="market-hint">{t('marketplaceJoin.mine.declared')}</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button onClick={onJoin} disabled={busy}>
        {busy ? t('marketplaceJoin.join.joining') : t('marketplaceJoin.join.submit')}
      </Button>
    </section>
  );
}
