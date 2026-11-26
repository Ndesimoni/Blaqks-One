import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { propertyTypes } from './requestOptions.js';
import { bands, emirateSlugs } from './requestsModel.js';

const ANY = '';
const BEDROOMS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * The board's five filters as one filter bar that wraps on phones (packet MK2), with Clear
 * filters once any is set. The server filters; this only holds the choices.
 */
export function MarketplaceBoardFilters({ filters, onChange, onClear }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const active = Object.values(filters).some((value) => value !== ANY);
  const field = (key, label, any, options) => (
    <div className="field market-filter">
      <label htmlFor={`market-filter-${key}`}>{label}</label>
      <select id={`market-filter-${key}`} value={filters[key]} onChange={set(key)}>
        <option value={ANY}>{any}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
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
        t('marketplaceRequests.board.anyPurpose'),
        [
          ['buy', t('marketplaceRequests.board.purpose.buy')],
          ['rent', t('marketplaceRequests.board.purpose.rent')],
        ],
      )}
      {field(
        'emirate',
        t('marketplaceRequests.post.emirate'),
        t('marketplaceRequests.board.anyEmirate'),
        emirateSlugs.map((slug) => [slug, t(`marketplaceJoin.emirate.${slug}`)]),
      )}
      {field(
        'propertyType',
        t('marketplaceRequests.post.propertyType'),
        t('marketplaceRequests.board.anyType'),
        propertyTypes.map((name) => [name, name]),
      )}
      {field(
        'bedrooms',
        t('marketplaceRequests.post.bedrooms'),
        t('marketplaceRequests.board.anyBedrooms'),
        BEDROOMS.map((count) => [
          String(count),
          count === 0
            ? t('marketplaceRequests.board.studio')
            : t('marketplaceRequests.board.bedrooms', { count }),
        ]),
      )}
      {field(
        'band',
        t('marketplaceRequests.post.budgetLabel'),
        t('marketplaceRequests.board.anyBand'),
        bands.map((band) => [band, t(`marketplaceRequests.band.${band}`)]),
      )}
      {active && (
        <Button variant="light" className="market-filters-clear" onClick={onClear}>
          {t('marketplaceRequests.board.clear')}
        </Button>
      )}
    </div>
  );
}
