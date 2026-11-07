import { select, link, esc } from './helpers.js';
import { purposes } from './property-options.js';
import {
  scopeFields,
  locationFields,
  typeField,
  budgetFields,
  priceHint,
  advancedFilters,
  filterErrorSummary,
} from './filter-controls.js';

export function filterPanel(ctx, invalid = false) {
  const s = ctx.scope,
    q = ctx.query;
  return `<aside class="filter-panel${invalid ? ' open' : ''}" id="filter-panel"><form data-form="filters" novalidate><div class="section-heading"><h2>Refine your search</h2>${link('Reset', 'properties', {}, s)}</div>${scopeFields(s)}<input type="hidden" name="sort" value="${esc(q.get('sort') || 'newest')}"><label>Search<input name="q" aria-label="Search properties" value="${esc(q.get('q') || '')}" placeholder="Property title or keyword"></label>${select('Purpose', 'purpose', [['', 'All purposes'], ...purposes], q.get('purpose') || '')}<div class="filter-location-fields">${locationFields(s, q)}</div>${typeField(q)}${priceHint(q)}${budgetFields(q)}${filterErrorSummary()}<div class="advanced-filter-groups">${advancedFilters(s, q)}</div><div class="filter-submit"><button class="button" type="submit">Apply filters →</button>${link('Clear all', 'properties', {}, s)}</div></form></aside>`;
}
