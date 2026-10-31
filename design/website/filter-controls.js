import { agents, companies } from './data.js';
import { developers } from './developer-data.js';
import { areasFor } from './property-geography.js';
import {
  emirates,
  types,
  commercialTypes,
  categories,
  furnishings,
  amenities,
  bedroomOptions,
  bathroomOptions,
  readiness,
  markets,
  priceBasis,
} from './property-options.js';
import { esc, select } from './helpers.js';
import { maxPrice } from './property-filter-validation.js';

const any = (label, name, options, q, text = 'Any') =>
  select(label, name, [['', text], ...options], q.get(name) || '');
export const scopeFields = (s) =>
  `<input type="hidden" name="site" value="${esc(s.site || '')}"><input type="hidden" name="theme" value="${esc(s.theme || '')}">`;
export function numericField(label, name, value = '', unit = '', disabled = false) {
  return `<label>${label}${unit ? ` <span class="sr-only">(${unit})</span>` : ''}<input type="number" inputmode="decimal" min="0" step="0.01" name="${name}" aria-label="${label}${unit ? ` (${unit})` : ''}" value="${esc(value || '')}" placeholder="Any" ${disabled ? 'disabled' : ''} aria-describedby="error-${name}"><span class="field-error" id="error-${name}" data-error-for="${name}"></span></label>`;
}
export function budgetFields(q) {
  return `<fieldset class="numeric-range budget-range"><legend class="sr-only">Budget range in AED</legend><div class="range-fields">${numericField('Min budget', 'minPrice', q.get('minPrice'), 'AED', !q.get('purpose'))}${numericField('Max budget', 'maxPrice', maxPrice(q), 'AED', !q.get('purpose'))}</div></fieldset>`;
}
export const priceHint = (q) =>
  `<span class="price-basis" data-price-basis>Budget in AED · ${priceBasis(q.get('purpose'))}</span>`;
export function locationFields(s, q) {
  return `${any('Emirate', 'emirate', emirates, q, 'All emirates')}${any(
    'Community / area',
    'area',
    areasFor(s, q.get('emirate')).map((a) => [a.id, a.name]),
    q,
    'All communities',
  )}`;
}
export function typeField(q) {
  const choices = types.filter(
    (type) =>
      !q.get('category') ||
      (commercialTypes.includes(type) ? 'commercial' : 'residential') === q.get('category'),
  );
  return any(
    'Property type',
    'type',
    choices.map((v) => [v, v]),
    q,
    'All property types',
  );
}
export function advancedFilters(s, q, expanded = false) {
  const has = (...keys) => (expanded || keys.some((key) => q.get(key)) ? ' open' : '');
  return `<details class="filter-group"${has('bedrooms', 'bathrooms', 'furnishing', 'parking')}><summary>Rooms & comfort</summary><div class="filter-group-fields">${any('Bedrooms', 'bedrooms', bedroomOptions, q, 'Any bedrooms')}${any('Bathrooms', 'bathrooms', bathroomOptions, q, 'Any bathrooms')}${any('Furnishing', 'furnishing', furnishings, q, 'Any furnishing')}${any(
    'Parking spaces',
    'parking',
    [
      ['1', '1+'],
      ['2', '2+'],
      ['3', '3+'],
    ],
    q,
    'Any parking',
  )}</div></details>
  <details class="filter-group"${has('minSize', 'maxSize', 'amenities')}><summary>Size & amenities</summary><div class="filter-group-fields"><fieldset class="numeric-range"><legend>Property size (sqft)</legend><div class="range-fields">${numericField('Min size', 'minSize', q.get('minSize'), 'sqft')}${numericField('Max size', 'maxSize', q.get('maxSize'), 'sqft')}</div></fieldset><fieldset class="amenity-filter"><legend>Amenities</legend>${amenities.map(([id, label]) => `<label class="check"><input type="checkbox" name="amenity" value="${id}"${(q.get('amenities') || '').split(',').includes(id) ? ' checked' : ''}>${label}</label>`).join('')}</fieldset></div></details>
  <details class="filter-group"${has('category', 'ready', 'market', 'developer', 'company', 'agent')}><summary>Listing & representative</summary><div class="filter-group-fields">${any('Property category', 'category', categories, q, 'Residential & commercial')}${any('Readiness', 'ready', readiness, q, 'Any readiness')}<div data-purpose="buy">${any('Sale market', 'market', markets, q, 'Primary & resale')}</div>${any(
    'Developer',
    'developer',
    developers.toSorted((a, b) => a.name.localeCompare(b.name)).map((d) => [d.id, d.name]),
    q,
    'All developers',
  )}${
    !s.site
      ? any(
          'Company',
          'company',
          companies.map((c) => [c.id, c.name]),
          q,
          'All companies',
        )
      : ''
  }${any(
    'Listing agent',
    'agent',
    agents.filter((a) => !s.site || a.company === s.site).map((a) => [a.id, a.name]),
    q,
    'All agents',
  )}</div></details>
  <details class="filter-group" data-purpose="holiday" open><summary>Holiday stay</summary><div class="filter-group-fields">${any(
    'Guests',
    'guests',
    [1, 2, 3, 4, 5, 6, 8, 10].map((n) => [String(n), `${n}+ guests`]),
    q,
    'Any capacity',
  )}${numericField('Stay length', 'nights', q.get('nights'), 'nights')}<small>Capacity and minimum stay only. Confirm dates and availability with the listing agent.</small></div></details>`;
}
export const filterErrorSummary = () =>
  '<p class="form-error filter-error-summary" role="alert" tabindex="-1" id="filter-error"></p>';
