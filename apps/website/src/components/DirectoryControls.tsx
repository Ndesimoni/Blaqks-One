import type { Query } from '../lib/types';
import { emirates } from '../lib/options';
import { first } from './ui';

export function DirectoryControls({ page, query }: { page: string; query: Query }) {
  return (
    <form className="directory-search" method="get">
      <label>
        Search {page}
        <input name="q" type="search" defaultValue={first(query.q)} />
      </label>
      {['developers', 'areas'].includes(page) && (
        <label>
          Emirate
          <select name="emirate" defaultValue={first(query.emirate)}>
            <option value="">All emirates</option>
            {emirates.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {page === 'developers' && (
        <label>
          Availability
          <select name="availability" defaultValue={first(query.availability)}>
            <option value="">All developers</option>
            <option value="available">With properties on this website</option>
          </select>
        </label>
      )}
      <button className="button" type="submit">
        Search →
      </button>
    </form>
  );
}
