import type { PageData } from '../lib/types';
import { DirectoryControls } from './DirectoryControls';
import { DirectoryContent } from './DirectoryContent';
import { Empty, Heading, Pagination, queryHref } from './ui';

const nouns: Record<string, [string, string]> = {
  areas: ['community', 'communities'],
  agents: ['agent', 'agents'],
  companies: ['company', 'companies'],
  developers: ['developer', 'developers'],
};
export function DirectoryPage({ page, catalogue, query, site, directory }: PageData) {
  const title =
    page === 'companies'
      ? 'Find your property company.'
      : page === 'agents'
        ? site.kind === 'company'
          ? 'A personal introduction.'
          : 'The people behind your next move.'
        : page === 'developers'
          ? 'The developers shaping the UAE.'
          : 'Find your sense of place.';
  const count =
    directory?.total ??
    (page === 'companies'
      ? catalogue.companies.length
      : page === 'agents'
        ? catalogue.agents.length
        : page === 'developers'
          ? catalogue.developers.length
          : catalogue.areas.length);
  const current = directory?.page || 1;
  const pages = Math.max(1, Math.ceil(count / (directory?.pageSize || 12)));
  const href = (number: number) =>
    queryHref(query, { page: String(number) }).replace('/properties?', `/${page}?`);
  return (
    <section className="section page-top">
      <Heading
        eyebrow={
          page === 'areas'
            ? 'THE NEIGHBOURHOODS'
            : page === 'developers'
              ? 'UAE DEVELOPERS'
              : page === 'agents' && site.kind === 'company'
                ? 'OUR PEOPLE'
                : 'PROPERTY & PEOPLE'
        }
        title={title}
        text={
          page === 'developers'
            ? 'Explore developer profiles and the properties currently represented on this website.'
            : 'Explore public profiles and the properties they represent.'
        }
      />
      <DirectoryControls page={page} query={query} />
      <p className="muted">
        {count} {count === 1 ? nouns[page]?.[0] : nouns[page]?.[1]}
      </p>
      {count === 0 ? (
        <Empty title="No matches found." text="Try another search or emirate." />
      ) : (
        <DirectoryContent page={page} catalogue={catalogue} />
      )}
      <Pagination page={current} pages={pages} href={href} label="Directory pages" />
    </section>
  );
}
