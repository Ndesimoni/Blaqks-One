import type { Catalogue, PageData, Query, Site } from './types.ts';
import { first } from './query.ts';

export const agentPageSize = 5;

type Loader = (site: Site, host: string, page: string, query: Query) => Promise<PageData>;

export async function platformAgents(
  site: Site,
  host: string,
  query: Query,
  load: Loader,
): Promise<PageData> {
  const raw = first(query, 'page');
  const requested = /^\d{1,6}$/.test(raw) ? Math.max(1, Number(raw)) : 1;
  const fetchPage = async (page: number) => {
    const data = await load(site, host, 'agents', { ...query, page: String(page) });
    if (!data.directory || data.directory.pageSize !== 12) {
      throw Error('Unsupported public agent pagination.');
    }
    return data;
  };
  let upstream = await fetchPage(Math.floor(((requested - 1) * agentPageSize) / 12) + 1);
  const total = upstream.directory!.total;
  const page = Math.min(requested, Math.max(1, Math.ceil(total / agentPageSize)));
  const offset = (page - 1) * agentPageSize;
  const backendPage = Math.floor(offset / 12) + 1;
  if (upstream.directory!.page !== backendPage) {
    upstream = await fetchPage(backendPage);
  }
  const localOffset = offset % 12;
  const agents = upstream.catalogue.agents.slice(localOffset, localOffset + agentPageSize);
  let catalogue = upstream.catalogue;
  if (agents.length < agentPageSize && offset + agents.length < total) {
    const next = await fetchPage(backendPage + 1);
    if (next.directory!.total !== total) throw Error('The public directory changed. Please retry.');
    agents.push(...next.catalogue.agents.slice(0, agentPageSize - agents.length));
    catalogue = mergeCatalogues(catalogue, next.catalogue);
  }
  return {
    ...upstream,
    query,
    catalogue: { ...catalogue, agents },
    directory: { total, page, pageSize: agentPageSize },
  };
}

function mergeCatalogues(a: Catalogue, b: Catalogue): Catalogue {
  const merge = <T extends { id: string }>(first: T[], second: T[]) => [
    ...new Map([...first, ...second].map((item) => [item.id, item])).values(),
  ];
  return {
    listings: merge(a.listings, b.listings),
    companies: merge(a.companies, b.companies),
    agents: merge(a.agents, b.agents),
    areas: merge(a.areas, b.areas),
    developers: merge(a.developers, b.developers),
  };
}
