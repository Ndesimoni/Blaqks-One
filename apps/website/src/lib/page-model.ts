import type { Catalogue, PageData, Query, Site } from './types.ts';
import { first } from './query.ts';
import { searchProperties } from './property-search.ts';

export const collections = {
  property: 'listings',
  company: 'companies',
  agent: 'agents',
  developer: 'developers',
  area: 'areas',
} as const;
export function samplePage(
  site: Site,
  catalogue: Catalogue,
  page: string,
  query: Query,
  id?: string,
): PageData | null {
  const data: PageData = { site, catalogue, page, query };
  if (Object.hasOwn(collections, page)) {
    const key = collections[page as keyof typeof collections];
    data.entity = catalogue[key].find((entry) => entry.id === id);
    if (!data.entity) return null;
  }
  if (page === 'properties') data.results = searchProperties(catalogue, query);
  if (['companies', 'agents', 'developers', 'areas'].includes(page)) {
    const key = page as 'companies' | 'agents' | 'developers' | 'areas';
    const term = first(query, 'q').toLowerCase().trim(),
      emirate = first(query, 'emirate');
    const list = catalogue[key].filter(
      (entry) =>
        (!term || entry.name.toLowerCase().includes(term)) &&
        (!emirate ||
          ('emirate' in entry &&
            (entry.emirate === emirate ||
              entry.emirate.toLowerCase().replaceAll(' ', '-') === emirate))) &&
        (first(query, 'availability') !== 'available' || (entry.publicListingCount || 0) > 0),
    );
    const raw = first(query, 'page');
    const pageNumber = Math.min(
      Math.max(1, /^\d+$/.test(raw) ? Number(raw) : 1),
      Math.max(1, Math.ceil(list.length / 12)),
    );
    data.directory = { total: list.length, page: pageNumber, pageSize: 12 };
    data.catalogue = { ...catalogue, [key]: list.slice((pageNumber - 1) * 12, pageNumber * 12) };
  }
  if (page === 'enquiry') {
    const listing = first(query, 'listing'),
      agent = first(query, 'agent'),
      company = first(query, 'company');
    const property = catalogue.listings.find((p) => p.id === listing);
    const person = catalogue.agents.find((a) => a.id === agent);
    if (
      (listing && !property) ||
      (agent && !person) ||
      (company && !catalogue.companies.some((c) => c.id === company))
    )
      return null;
    if (
      property &&
      ((agent && property.agent !== agent) || (company && property.company !== company))
    )
      return null;
    if (person && company && person.company !== company) return null;
    data.entity = property || person || catalogue.companies.find((c) => c.id === company);
  }
  return data;
}

export function validateCatalogueScope(catalogue: Catalogue, site: Site): void {
  if (
    site.company &&
    (catalogue.companies.some((c) => c.id !== site.company) ||
      catalogue.agents.some((a) => a.company !== site.company) ||
      catalogue.listings.some((p) => p.company !== site.company))
  )
    throw Error('Public catalogue scope mismatch.');
  for (const listing of catalogue.listings) {
    const agent = catalogue.agents.find((a) => a.id === listing.agent);
    if (
      !agent ||
      agent.company !== listing.company ||
      !catalogue.companies.some((c) => c.id === listing.company) ||
      !catalogue.areas.some((a) => a.id === listing.area)
    )
      throw Error('Invalid public listing relationships.');
  }
}
