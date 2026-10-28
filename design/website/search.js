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

export function search(scope = {}) {
  const q = new URLSearchParams('purpose=buy');
  return `<form class="search-box" data-form="search" novalidate>${scopeFields(scope)}<div class="search-top"><fieldset class="purpose"><legend class="sr-only">Property purpose</legend>${purposes.map(([id, label], index) => `<label><input type="radio" name="purpose" value="${id}"${index === 0 ? ' checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>${priceHint(q)}</div><div class="search-fields">${locationFields(scope, q)}${typeField(q)}${budgetFields(q)}<button class="button" type="submit">Search properties <span aria-hidden="true">→</span></button></div>${filterErrorSummary()}<details class="search-advanced"><summary>More filters <span>Rooms, size, features & more</span></summary><div class="search-advanced-grid">${advancedFilters(scope, q, true)}</div><div class="search-advanced-footer"><button class="button" type="submit">Search properties →</button><button class="button quiet" type="reset">Clear filters</button></div></details></form>`;
}
