import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { CompanyTeam } from './CompanyCards';
import { Pagination, first, queryHref } from '../ui';

export function CompanyPeople({ site, catalogue, directory, query }: PageData) {
  const page = directory?.page || 1;
  const total = directory?.total || 0;
  const pages = Math.max(1, Math.ceil(total / (directory?.pageSize || 5)));
  const href = (value: number) =>
    queryHref(query, { page: String(value) }).replace('/properties?', '/agents?');
  return (
    <div className="a-container a-inner">
      <section className="a-page-intro">
        <p className="a-kicker">THE PEOPLE BEHIND YOUR NEXT MOVE</p>
        <h1>
          The right people.
          <br />A more personal search.
        </h1>
        <p>
          Meet the team at {site.name}. A personal point of contact, from the first question to the
          next step.
        </p>
      </section>
      <form className="a-people-search" method="get">
        <label>
          Find your advisor
          <input
            name="q"
            type="search"
            placeholder="Search by name"
            defaultValue={first(query.q)}
          />
        </label>
        <button className="a-action">Find an advisor ↗</button>
      </form>
      <p className="a-results-heading">
        {total} {total === 1 ? 'advisor' : 'advisors'} in our team
      </p>
      {catalogue.agents.length ? (
        <CompanyTeam catalogue={catalogue} limit={5} />
      ) : (
        <div className="empty-state">
          <h2>No matching advisors.</h2>
          <p>
            Try another name or <Link href="/agents">view the team</Link>.
          </p>
        </div>
      )}
      <Pagination page={page} pages={pages} href={href} label="Team pages" />
    </div>
  );
}
