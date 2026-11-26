import Link from 'next/link';
import type { PageData } from '../lib/types';
import { PropertyGrid } from './Cards';
import { SearchForm } from './SearchForm';
import { Empty, Heading, Pagination, queryHref } from './ui';

export function PropertiesPage({ catalogue, results, query }: PageData) {
  const total = results?.total || 0;
  const page = results?.page || 1;
  const pages = Math.max(1, Math.ceil(total / (results?.pageSize || 12)));
  return (
    <section className="section page-top">
      <Heading
        eyebrow="THE COLLECTION"
        title="A place for every next chapter."
        text="Discover homes, investment opportunities and spaces for your business."
      />
      <SearchForm key={JSON.stringify(query)} query={query} catalogue={catalogue} />
      {!!results?.errors.length && (
        <div className="form-error" role="alert">
          <h2>Check your filters</h2>
          <ul>
            {results.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="results-heading">
        <p aria-live="polite">
          <strong>{total}</strong> {total === 1 ? 'property' : 'properties'} found
        </p>
        <Link href="/properties">Clear filters</Link>
      </div>
      {results?.items.length ? (
        <PropertyGrid listings={results.items} catalogue={catalogue} />
      ) : (
        <Empty />
      )}
      <Pagination
        page={page}
        pages={pages}
        href={(number) => queryHref(query, { page: String(number) })}
        label="Property result pages"
      />
    </section>
  );
}
