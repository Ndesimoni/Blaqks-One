import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const ANY = '';

/** The board's five filters, in a row that wraps on phones (packet MK2). */
export function MarketplaceBoardFilters({ filters, onChange }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const field = (key, label, children) => (
    <div className="field market-filter">
      <label htmlFor={`market-filter-${key}`}>{label}</label>
      <select id={`market-filter-${key}`} value={filters[key]} onChange={set(key)}>
        {children}
      </select>
    </div>
  );
  return (
    <div
      className="market-filters"
      role="group"
      aria-label={t('marketplaceRequests.board.filters')}
    >
      {field(
        'purpose',
        t('marketplaceRequests.post.purpose'),
        <>
          <option value={ANY}>{t('marketplaceRequests.board.anyPurpose')}</option>
          <option value="buy">{t('marketplaceRequests.board.purpose.buy')}</option>
          <option value="rent">{t('marketplaceRequests.board.purpose.rent')}</option>
        </>,
      )}
      {field(
        'emirate',
        t('marketplaceRequests.post.emirate'),
        <>
          <option value={ANY}>{t('marketplaceRequests.board.anyEmirate')}</option>
          {[
            'dubai',
            'abu-dhabi',
            'sharjah',
            'ajman',
            'umm-al-quwain',
            'ras-al-khaimah',
            'fujairah',
          ].map((slug) => (
            <option key={slug} value={slug}>
              {t(`marketplaceJoin.emirate.${slug}`)}
            </option>
          ))}
        </>,
      )}
      {field(
        'propertyType',
        t('marketplaceRequests.post.propertyType'),
        <>
          <option value={ANY}>{t('marketplaceRequests.board.anyType')}</option>
          {[
            'Apartment',
            'Studio',
            'Villa',
            'Townhouse',
            'Penthouse',
            'Duplex',
            'Loft',
            'Serviced apartment',
            'Hotel apartment',
            'Office',
            'Retail',
            'Shop',
            'Showroom',
            'Warehouse',
            'Industrial',
            'Commercial building',
            'Residential building',
            'Plot',
            'Land',
            'Other',
          ].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </>,
      )}
      {field(
        'bedrooms',
        t('marketplaceRequests.post.bedrooms'),
        <>
          <option value={ANY}>{t('marketplaceRequests.board.anyBedrooms')}</option>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
            <option key={count} value={String(count)}>
              {count === 0
                ? t('marketplaceRequests.board.studio')
                : t('marketplaceRequests.board.bedrooms', { count })}
            </option>
          ))}
        </>,
      )}
      {field(
        'band',
        t('marketplaceRequests.post.budgetLabel'),
        <>
          <option value={ANY}>{t('marketplaceRequests.board.anyBand')}</option>
          {[
            'buy_1m',
            'buy_2m',
            'buy_3m',
            'buy_5m',
            'buy_10m',
            'buy_10m_plus',
            'rent_50k',
            'rent_100k',
            'rent_150k',
            'rent_250k',
            'rent_500k',
            'rent_500k_plus',
          ].map((band) => (
            <option key={band} value={band}>
              {t(`marketplaceRequests.band.${band}`)}
            </option>
          ))}
        </>,
      )}
    </div>
  );
}
