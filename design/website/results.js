import { companyBy } from './data.js';
import { heading, grid, button, esc, notice, url } from './helpers.js';
import { filtered, sortedProperties } from './property-filter-model.js';
import { filterErrors } from './property-filter-validation.js';
import { filterPanel } from './filter-panel.js';
import { filterChips } from './filter-chips.js';
import { sortOptions } from './property-options.js';
export { filtered } from './property-filter-model.js';

export function results(ctx) {
  const q = ctx.query,
    s = ctx.scope,
    errors = filterErrors(q);
  const stock = sortedProperties(filtered(ctx), q);
  const totalPages = Math.ceil(stock.length / 12);
  const page = Math.max(1, Math.min(Math.floor(Number(q.get('page'))) || 1, totalPages || 1));
  const company = companyBy(s.site),
    params = Object.fromEntries(q);
  const currentSort = q.get('sort') === 'default' ? 'newest' : q.get('sort') || 'newest';
  return `<section class="section page-top">${heading(company ? esc(company.name) : 'THE PUBLIC COLLECTION', 'Find your next address.', `${stock.length} public ${stock.length === 1 ? 'listing' : 'listings'} · Fictional sample inventory`)}
    <button class="button quiet mobile-filter" data-action="filters" aria-expanded="${errors.length ? 'true' : 'false'}" aria-controls="filter-panel">Filters & search <span aria-hidden="true">☷</span></button>
    <div class="results-layout">${filterPanel(ctx, errors.length > 0)}<div class="results-content"><div class="result-toolbar"><strong role="status">${stock.length ? `Showing ${(page - 1) * 12 + 1}–${Math.min(page * 12, stock.length)} of ${stock.length}` : 'No matching properties'}</strong><label class="sort-label">Sort<select data-action="sort" aria-label="Sort properties">${sortOptions.map(([id, label]) => `<option value="${id}"${currentSort === id ? ' selected' : ''}${id.startsWith('price-') && !q.get('purpose') ? ' disabled' : ''}>${label}</option>`).join('')}</select></label></div>${!q.get('purpose') ? '<p class="sort-hint">Choose Buy, Rent or Holiday homes to sort by price.</p>' : ''}
    ${filterChips(q, s)}${errors.length ? notice(errors.map((error) => esc(error.message)).join(' ')) : ''}
    ${stock.length ? grid(stock.slice((page - 1) * 12, page * 12), s) : `<div class="empty"><h2>A little more room to explore.</h2><p>${errors.length ? 'Review the filters above and correct the highlighted values.' : 'There are no sample properties for this combination. Try another emirate, community or budget. Your filters have not been widened automatically.'}</p>${button('Clear filters', 'properties', {}, s)}</div>`}
    <nav class="pagination" aria-label="Results pages">${Array.from({ length: totalPages }, (_, index) => `<a class="page-number${page === index + 1 ? ' active' : ''}" href="${esc(url('properties', { ...params, page: String(index + 1) }, s))}"${page === index + 1 ? ' aria-current="page"' : ''}>${index + 1}</a>`).join('')}</nav></div></div></section>`;
}
