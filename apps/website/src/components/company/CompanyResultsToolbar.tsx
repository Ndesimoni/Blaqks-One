import type { Query } from '../../lib/types';
import { first } from '../ui';
import { sortOptions } from '../../lib/options';

function RetainedQuery({ query, skip }: { query: Query; skip: string[] }) {
  return (
    <>
      {Object.entries(query).flatMap(([key, value]) =>
        skip.includes(key)
          ? []
          : (Array.isArray(value) ? value : [value])
              .filter(Boolean)
              .map((item, i) => <input key={key + i} type="hidden" name={key} value={item} />),
      )}
    </>
  );
}
export function CompanyResultsToolbar({ query }: { query: Query }) {
  return (
    <div className="a-results-toolbar">
      <form method="get" action="/properties" role="search">
        <RetainedQuery query={query} skip={['q', 'page']} />
        <label>
          <span className="sr-only">Search properties</span>
          <input
            name="q"
            type="search"
            placeholder="Search by property or location"
            defaultValue={first(query.q)}
          />
        </label>
        <button type="submit" className="a-action">
          Search
        </button>
      </form>
      <form method="get" action="/properties">
        <RetainedQuery query={query} skip={['sort', 'page']} />
        <label>
          Sort by
          <select name="sort" defaultValue={first(query.sort) || 'newest'}>
            {sortOptions.map(([value, label]) => (
              <option
                key={value}
                value={value}
                disabled={value.startsWith('price-') && !first(query.purpose)}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="a-sort-submit" type="submit">
          Apply
        </button>
      </form>
    </div>
  );
}
