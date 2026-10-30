import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceRequestPreferenceFields } from './MarketplaceRequestPreferenceFields.jsx';
import { bandFor, wholeDirhams } from './requestBands.js';
import { bedroomChoices, propertyTypes } from './requestOptions.js';

const EMIRATES = [
  'dubai',
  'abu-dhabi',
  'sharjah',
  'ajman',
  'umm-al-quwain',
  'ras-al-khaimah',
  'fujairah',
];

/** The request fields, in one form grid, shared by posting and editing (packet MK2). */
export function MarketplaceRequestForm({ draft, onChange, prefix = 'request' }) {
  const { t } = useI18n();
  const set = (key) => (event) =>
    onChange({
      ...draft,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    });
  const band = bandFor(draft.purpose, wholeDirhams(draft.budgetMaxAed));
  const id = (key) => `${prefix}-${key}`;
  const field = (key, label, control) => (
    <div className="field">
      <label htmlFor={id(key)}>{label}</label>
      {control}
    </div>
  );
  return (
    <div className="form-grid">
      {field(
        'purpose',
        t('marketplaceRequests.post.purpose'),
        <select id={id('purpose')} value={draft.purpose} onChange={set('purpose')}>
          <option value="rent">{t('marketplaceRequests.board.purpose.rent')}</option>
          <option value="buy">{t('marketplaceRequests.board.purpose.buy')}</option>
        </select>,
      )}
      {field(
        'emirate',
        t('marketplaceRequests.post.emirate'),
        <select id={id('emirate')} value={draft.emirate} onChange={set('emirate')}>
          {EMIRATES.map((slug) => (
            <option key={slug} value={slug}>
              {t(`marketplaceJoin.emirate.${slug}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        'propertyType',
        t('marketplaceRequests.post.propertyType'),
        <select id={id('propertyType')} value={draft.propertyType} onChange={set('propertyType')}>
          {propertyTypes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>,
      )}
      {field(
        'bedrooms',
        t('marketplaceRequests.post.bedrooms'),
        <select id={id('bedrooms')} value={draft.bedrooms} onChange={set('bedrooms')}>
          <option value="">{t('marketplaceRequests.board.anyBedrooms')}</option>
          {bedroomChoices.map((count) => (
            <option key={count} value={String(count)}>
              {count === 0
                ? t('marketplaceRequests.board.studio')
                : t('marketplaceRequests.board.bedrooms', { count })}
            </option>
          ))}
        </select>,
      )}
      {field(
        'budgetMinAed',
        t('marketplaceRequests.post.budgetMin'),
        <input
          id={id('budgetMinAed')}
          inputMode="numeric"
          value={draft.budgetMinAed}
          onChange={set('budgetMinAed')}
        />,
      )}
      {field(
        'budgetMaxAed',
        t('marketplaceRequests.post.budgetMax'),
        <input
          id={id('budgetMaxAed')}
          inputMode="numeric"
          value={draft.budgetMaxAed}
          onChange={set('budgetMaxAed')}
        />,
      )}
      {band && (
        <p className="market-hint market-band">
          {t('marketplaceRequests.post.band', {
            band: t(`marketplaceRequests.band.${band}`),
          })}
        </p>
      )}
      <MarketplaceRequestPreferenceFields draft={draft} onChange={onChange} prefix={prefix} />
    </div>
  );
}
