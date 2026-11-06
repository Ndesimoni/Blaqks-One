import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { CompanyFilterPanel } from './CompanyFilterPanel';
import { CompanyResultsToolbar } from './CompanyResultsToolbar';
import { SearchForm } from '../SearchForm';
import { Empty, queryHref } from '../ui';
import { CompanyGrid } from './CompanyCards';

export function CompanyProperties({ catalogue, results, query }: PageData) {
  const total = results?.total || 0;
  const page = results?.page || 1;
  const pages = Math.max(1, Math.ceil(total / (results?.pageSize || 12)));
  return (
    <div className="a-container a-inner a-catalogue-page">
      <p className="breadcrumb">
        <Link href="/">Home</Link> / Properties
      </p>
      <section className="a-page-intro">
        <p className="a-kicker">FIND YOUR PLACE</p>
        <h1>
          Room for
          <br />
          your next chapter.
        </h1>
        <p>Explore the collection. Make it your own.</p>
      </section>
      <div className="a-catalogue-layout">
        <CompanyFilterPanel>
          <SearchForm key={JSON.stringify(query)} query={query} catalogue={catalogue} sidebar />
        </CompanyFilterPanel>
        <section className="a-catalogue-results" aria-label="Property results">
          <CompanyResultsToolbar query={query} />
          {!!results?.errors.length && (
            <div className="form-error" role="alert">
              <h2>Check your filters</h2>
              <ul>
                {results.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="a-results-heading">
            <p aria-live="polite">
              {total} {total === 1 ? 'property' : 'properties'} in the collection
            </p>
            <Link href="/properties">Reset filters ↗</Link>
          </div>
          {results?.items.length ? (
            <CompanyGrid listings={results.items} catalogue={catalogue} />
          ) : (
            <Empty />
          )}
          <nav className="pagination" aria-label="Property pages">
            {page > 1 && (
              <Link href={queryHref(query, { page: String(page - 1) })}>← Previous</Link>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link href={queryHref(query, { page: String(page + 1) })}>Next →</Link>
            )}
          </nav>
        </section>
      </div>
    </div>
  );
}
