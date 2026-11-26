import { areaBy, companyBy, agentBy } from './data.js';
import { developerBy } from './developer-data.js';
import {
  emirates,
  purposes,
  categories,
  furnishings,
  readiness,
  markets,
  amenities,
  bedroomOptions,
  priceBasis,
  optionLabel,
} from './property-options.js';
import { link } from './helpers.js';
import { esc } from './helpers.js';
import { maxPrice } from './property-filter-validation.js';

export function filterChips(q, scope) {
  const chips = [],
    params = Object.fromEntries(q);
  const add = (label, keys) =>
    chips.push(
      link(
        `${esc(label)} <span aria-hidden="true">×</span><span class="sr-only"> Remove filter</span>`,
        'properties',
        { ...params, ...Object.fromEntries(keys.map((key) => [key, ''])), page: '1' },
        scope,
        'chip',
      ),
    );
  const choices = {
    emirate: ['Emirate', emirates],
    purpose: ['Purpose', purposes],
    category: ['Category', categories],
    furnishing: ['Furnishing', furnishings],
    ready: ['Readiness', readiness],
    market: ['Sale market', markets],
    bedrooms: ['Bedrooms', bedroomOptions],
  };
  for (const [key, [label, options]] of Object.entries(choices))
    if (q.get(key)) add(`${label}: ${optionLabel(options, q.get(key))}`, [key]);
  const named = {
    area: ['Community', areaBy(q.get('area'))?.name],
    company: ['Company', companyBy(q.get('company'))?.name],
    agent: ['Agent', agentBy(q.get('agent'))?.name],
    developer: ['Developer', developerBy(q.get('developer'))?.name],
    type: ['Type', q.get('type')],
    q: ['Search', q.get('q')],
  };
  for (const [key, [label, value]] of Object.entries(named))
    if (q.get(key)) add(`${label}: ${value || 'Unavailable selection'}`, [key]);
  const number = (value) =>
    Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-AE') : 'Invalid';
  if (q.get('minPrice') || maxPrice(q))
    add(
      `Budget: AED ${q.get('minPrice') ? number(q.get('minPrice')) : '0'}–${maxPrice(q) ? number(maxPrice(q)) : 'Any'} · ${priceBasis(q.get('purpose'))}`,
      ['minPrice', 'maxPrice', 'budget'],
    );
  if (q.get('minSize') || q.get('maxSize'))
    add(
      `Size: ${q.get('minSize') ? number(q.get('minSize')) : '0'}–${q.get('maxSize') ? number(q.get('maxSize')) : 'Any'} sqft`,
      ['minSize', 'maxSize'],
    );
  for (const [key, label] of [
    ['bathrooms', 'Bathrooms'],
    ['parking', 'Parking spaces'],
    ['guests', 'Guests'],
  ])
    if (q.get(key)) add(`${label}: ${q.get(key)}+`, [key]);
  if (q.get('nights')) add(`Stay: ${q.get('nights')} nights`, ['nights']);
  if (q.get('amenities'))
    add(
      `Amenities: ${q
        .get('amenities')
        .split(',')
        .map((value) => optionLabel(amenities, value))
        .join(', ')}`,
      ['amenities'],
    );
  return `<div class="chips" aria-label="Applied filters">${chips.join('')}</div>`;
}
