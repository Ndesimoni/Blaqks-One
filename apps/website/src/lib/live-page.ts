import 'server-only';
import type { PageData, Query, Site } from './types.ts';
import { publicGet, PublicNotFound } from './public-api.ts';
import { decodeCatalogue, decodeEntity, decodeListing, object } from './public-shapes.ts';
import { collections, validateCatalogueScope } from './page-model.ts';
import { first, queryParams } from './query.ts';
import { bindPublicAssets } from './public-assets.ts';

function pagination(value: unknown) {
  const row = object(value);
  for (const key of ['total', 'page', 'pageSize'])
    if (!Number.isSafeInteger(row[key]) || Number(row[key]) < (key === 'total' ? 0 : 1))
      throw Error('Invalid public pagination.');
  if (Number(row.pageSize) > 12) throw Error('Unsupported public page size.');
  return { total: Number(row.total), page: Number(row.page), pageSize: Number(row.pageSize) };
}

export async function livePage(
  site: Site,
  host: string,
  page: string,
  query: Query,
  id?: string,
): Promise<PageData> {
  const root = `sites/${encodeURIComponent(site.id)}`;
  const singular = Object.hasOwn(collections, page);
  const directory = ['companies', 'agents', 'developers', 'areas'].includes(page);
  const collection = singular
    ? collections[page as keyof typeof collections]
    : page === 'properties'
      ? 'listings'
      : page;
  let path = singular
    ? `${root}/${collection}/${encodeURIComponent(id || '')}`
    : directory || page === 'properties'
      ? `${root}/${collection}`
      : `${root}/home`;
  if (page === 'enquiry' && first(query, 'listing'))
    path = `${root}/listings/${encodeURIComponent(first(query, 'listing'))}`;
  else if (page === 'enquiry' && first(query, 'agent'))
    path = `${root}/agents/${encodeURIComponent(first(query, 'agent'))}`;
  else if (page === 'enquiry' && first(query, 'company'))
    path = `${root}/companies/${encodeURIComponent(first(query, 'company'))}`;
  const response = await publicGet(path, host, queryParams(query));
  const home = path.endsWith('/home');
  const catalogue = decodeCatalogue(home ? response.data : response.included);
  const data: PageData = { site, catalogue, page, query };
  if (page === 'properties') {
    if (!Array.isArray(response.data) || response.data.length > 12)
      throw Error('Invalid public listings page.');
    const items = response.data.map(decodeListing);
    catalogue.listings = items;
    const errors = response.errors ?? [];
    if (
      !Array.isArray(errors) ||
      errors.length > 30 ||
      errors.some((e) => typeof e !== 'string' || e.length > 500)
    )
      throw Error('Invalid filter feedback.');
    data.results = { items, ...pagination(response.pagination), errors };
  } else if (directory) {
    if (!Array.isArray(response.data) || response.data.length > 12)
      throw Error('Invalid public directory.');
    const entries = response.data.map((entry) => decodeEntity(page, entry));
    Object.assign(catalogue, { [page]: entries });
    data.directory = pagination(response.pagination);
  } else if (!home) {
    const isListing = page === 'property' || Boolean(page === 'enquiry' && first(query, 'listing'));
    const kind = singular ? collection : first(query, 'agent') ? 'agents' : 'companies';
    data.entity = isListing ? decodeListing(response.data) : decodeEntity(kind, response.data);
    const requestedId =
      id || first(query, 'listing') || first(query, 'agent') || first(query, 'company');
    if (data.entity.id !== requestedId) throw new PublicNotFound('Public content not found.');
    const key = isListing ? 'listings' : kind;
    const existing = catalogue[key as keyof typeof catalogue];
    Object.assign(catalogue, {
      [key]: [...existing.filter((entry) => entry.id !== data.entity?.id), data.entity],
    });
  }
  validateCatalogueScope(catalogue, site);
  if (page === 'enquiry' && data.entity) {
    const relatedCompany = 'company' in data.entity ? data.entity.company : data.entity.id;
    if (first(query, 'company') && relatedCompany !== first(query, 'company'))
      throw Error('Invalid enquiry recipient.');
    if (
      'agent' in data.entity &&
      first(query, 'agent') &&
      data.entity.agent !== first(query, 'agent')
    )
      throw Error('Invalid enquiry representative.');
  }
  return bindPublicAssets(data, process.env.WEBSITE_API_ORIGIN || '');
}
