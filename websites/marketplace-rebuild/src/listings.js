import { properties, companies, escapeHTML as esc } from './data.js';
import { cards, dealCard, heading } from './components.js';
import { filterProperties } from './state.js';

function select(name, label, options, params) {
  const values = options.map(v => Array.isArray(v) ? v : [v, v]);
  return `<label>${label}<select name="${name}"><option value="">All</option>
    ${values.map(([value, text]) => `<option value="${esc(value)}"
      ${params.get(name) === String(value) ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}

export function listingsPage(params, deals = false) {
  const purpose = params.get('purpose');
  const result = filterProperties(properties, params);
  const number = (name, label) => `<label>${label}<input type="number" min="0"
    name="${name}" value="${esc(params.get(name) || '')}"
    ${!purpose && ['min', 'max'].includes(name) ? 'disabled' : ''}></label>`;
  return `<main id="main">${heading(deals ? 'OPPORTUNITIES WITH CONTEXT' : 'A PLACE FOR YOUR NEXT CHAPTER',
    deals ? 'Property deals, in perspective.' : 'Find somewhere exceptional.',
    'Considered spaces. Distinctive locations. A search made personal.')}
    <div class="wrap listing-layout"><aside class="filter-panel"><h2>Refine your search</h2>
    <form id="filters" data-route="${deals ? 'deals' : 'properties'}">
    <label>Search<input name="q" type="search" value="${esc(params.get('q') || '')}"
      placeholder="Property or neighbourhood"></label>
    ${select('purpose', 'Purpose', [['Buy', 'For sale'], ['Rent', 'For rent']], params)}
    ${select('area', 'Location', [...new Set(properties.map(p => p.area))], params)}
    ${select('type', 'Property type', ['Apartment', 'Villa', 'Townhouse', 'Office'], params)}
    <div class="form-pair">${number('min', 'Minimum price · AED')}${number('max', 'Maximum price · AED')}</div>
    <p class="field-note">${purpose === 'Rent' ? 'Annual rental prices.' :
      purpose ? 'Total sale asking prices.' : 'Choose a purpose to set a price range.'}</p>
    ${select('beds', 'Bedrooms', [['0', 'Studio'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5+']], params)}
    ${select('baths', 'Bathrooms', [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']], params)}
    ${select('status', 'Sample listing status', ['Available', 'Under offer', 'Rented', 'Sold'], params)}
    ${select('deal', 'Deal type', ['Distress', 'Discount'], params)}
    <details><summary>More filters</summary>
    <div class="form-pair">${number('sizeMin', 'Min. area · sq ft')}${number('sizeMax', 'Max. area · sq ft')}</div>
    ${select('furnishing', 'Furnishing', ['Furnished', 'Partly furnished', 'Unfurnished'], params)}
    ${select('completion', 'Completion', ['Ready', 'Off-plan'], params)}
    ${select('company', 'Company', companies.map(c => [c.id, c.name]), params)}
    <fieldset><legend>Amenities</legend>${['Pool', 'Garden', 'Parking', 'Balcony', 'Gym'].map(a =>
      `<label class="check"><input type="checkbox" name="amenity" value="${a}"
        ${params.getAll('amenity').includes(a) ? 'checked' : ''}>${a}</label>`).join('')}</fieldset>
    </details>
    ${select('sort', 'Sort by', [['recommended', 'Recommended'], ['size', 'Size: largest first'],
      ...(purpose ? [['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']] : [])], params)}
    <button class="button navy">Apply filters →</button>
    <a class="text-link" href="#${deals ? 'deals' : 'properties'}">Reset all</a></form></aside>
    <section class="results"><div class="section-heading"><div><p class="eyebrow">EXPLORE THE COLLECTION</p>
      <h2>${deals ? 'Discover the opportunities.' : 'Properties in Dubai'}</h2></div>
      <span role="status">${result.length} sample properties</span></div>
    <div class="active-filters">${[...params].filter(([, v]) => v).map(([k, v]) =>
      `<span>${esc(k)}: ${esc(v)}</span>`).join('')}</div>
    <div class="property-grid">${deals ? result.map(dealCard).join('') || cards([]) : cards(result)}</div>
    <p class="sample-note">Showing ${result.length} of ${properties.length} illustrative listings.
      Sale prices and annual rents are compared separately.</p>
    ${deals ? '<p class="sample-note">Reference prices, savings and seller circumstances are unverified examples.</p>' : ''}
    </section></div></main>`;
}
