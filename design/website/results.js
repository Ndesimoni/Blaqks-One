import { properties, areas, companies, agents, companyBy } from './data.js';
import { heading, grid, select, link, button, esc, notice } from './helpers.js';
export function filtered(ctx) {
  const q = ctx.query;
  return properties.filter(
    (p) =>
      (!ctx.scope.site || p.company === ctx.scope.site) &&
      (!q.get('purpose') || p.purpose === q.get('purpose')) &&
      (!q.get('area') || p.area === q.get('area')) &&
      (!q.get('type') || p.type === q.get('type')) &&
      (!q.get('company') || p.company === q.get('company')) &&
      (!q.get('agent') || p.agent === q.get('agent')) &&
      (!q.get('ready') || p.ready === q.get('ready')) &&
      (!q.get('budget') || (q.get('purpose') && p.price <= Number(q.get('budget')))) &&
      (!q.get('q') || p.title.toLowerCase().includes(q.get('q').toLowerCase())),
  );
}
export function results(ctx) {
  const q = ctx.query,
    s = ctx.scope;
  let stock = filtered(ctx);
  if (q.get('sort') === 'name') stock = stock.toSorted((a, b) => a.title.localeCompare(b.title));
  const page = Math.max(1, Math.min(Number(q.get('page')) || 1, Math.ceil(stock.length / 12) || 1));
  const c = companyBy(s.site);
  const params = Object.fromEntries(q);
  const chips = [...q].filter(
    ([k, v]) =>
      v && ['purpose', 'area', 'type', 'company', 'agent', 'ready', 'budget', 'q'].includes(k),
  );
  return `<section class="section page-top">${heading(c ? esc(c.name) : 'THE PUBLIC COLLECTION', 'Find your next address.', `${stock.length} public ${stock.length === 1 ? 'listing' : 'listings'} · Fictional sample inventory`)}
    <button class="button quiet mobile-filter" data-action="filters" aria-expanded="false" aria-controls="filter-panel">Filters & search <span>☷</span></button>
    <div class="results-layout"><aside class="filter-panel" id="filter-panel"><form data-form="filters"><div class="section-heading"><h2>Refine your search</h2>${link('Reset', 'properties', {}, s)}</div>
      <input type="hidden" name="site" value="${esc(s.site || '')}"><input type="hidden" name="theme" value="${esc(s.theme || '')}">
      <label>Search<input name="q" value="${esc(q.get('q') || '')}" placeholder="Search properties"></label>
      ${select(
        'Purpose',
        'purpose',
        [
          ['', 'All purposes'],
          ['buy', 'Buy'],
          ['rent', 'Rent'],
          ['holiday', 'Holiday homes'],
        ],
        q.get('purpose') || '',
      )}
      ${select('Location', 'area', [['', 'All areas'], ...areas.map((a) => [a.id, a.name])], q.get('area') || '')}
      ${select('Property type', 'type', [['', 'All types'], ...['Apartment', 'Villa', 'Townhouse', 'Office'].map((v) => [v, v])], q.get('type') || '')}
      ${select(
        'Readiness',
        'ready',
        [
          ['', 'Any readiness'],
          ['ready', 'Ready'],
          ['off-plan', 'Off-plan'],
        ],
        q.get('ready') || '',
      )}
      ${!s.site ? select('Company', 'company', [['', 'All companies'], ...companies.map((v) => [v.id, v.name])], q.get('company') || '') : ''}
      ${select('Listing agent', 'agent', [['', 'All agents'], ...agents.filter((a) => !s.site || a.company === s.site).map((v) => [v.id, v.name])], q.get('agent') || '')}
      <label><span data-budget-label>Maximum ${q.get('purpose') === 'rent' ? 'annual rent' : q.get('purpose') === 'holiday' ? 'nightly rate' : 'sale price'} (AED)</span><input type="number" min="0" name="budget" value="${esc(q.get('budget') || '')}" placeholder="Any price" ${q.get('purpose') ? '' : 'disabled'}><small>Choose Buy, Rent or Holiday homes before applying a budget.</small></label>
      <button class="button" type="submit">Apply filters →</button></form></aside>
      <div class="results-content"><div class="result-toolbar"><strong>${stock.length ? `Showing ${(page - 1) * 12 + 1}–${Math.min(page * 12, stock.length)} of ${stock.length}` : 'No matching properties'}</strong><label class="sort-label">Sort<select data-action="sort"><option value="default" ${q.get('sort') !== 'name' ? 'selected' : ''}>Recently added</option><option value="name" ${q.get('sort') === 'name' ? 'selected' : ''}>Property name</option></select></label></div>
      ${q.get('budget') && !q.get('purpose') ? notice('Choose a property purpose before applying this budget. Sale, annual rental and nightly prices are not comparable.') : ''}
      <div class="chips">${chips.map(([k, v]) => link(`${esc(k)}: ${esc(v)} ×`, 'properties', { ...params, [k]: '', page: '1' }, s, 'chip')).join('')}</div>
      ${stock.length ? grid(stock.slice((page - 1) * 12, page * 12), s) : `<div class="empty"><span>⌕</span><h2>A little more room to explore.</h2><p>Try changing an area, property type or budget. Your filters have not been widened automatically.</p>${button('Clear filters', 'properties', {}, s)}</div>`}
      <nav class="pagination" aria-label="Results pages">${Array.from({ length: Math.ceil(stock.length / 12) }, (_, i) => link(String(i + 1), 'properties', { ...params, page: String(i + 1) }, s, `page-number${page === i + 1 ? ' active' : ''}`)).join('')}</nav></div></div></section>`;
}
