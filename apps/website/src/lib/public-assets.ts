import type { PageData } from './types.ts';

const mediaPath = /^\/api\/public\/v1\/sites\/[0-9a-f-]{36}\/media\/[0-9a-f-]{36}$/i;
export function isPublicMedia(value: string): boolean {
  if (!value.startsWith('/api/public/v1/')) return false;
  const parsed = new URL(value, 'https://public.invalid');
  const host = parsed.searchParams.get('host') || '';
  return (
    mediaPath.test(parsed.pathname) &&
    !parsed.hash &&
    [...parsed.searchParams.keys()].length === 1 &&
    /^[a-z0-9.-]{1,253}$/i.test(host) &&
    !host.startsWith('.') &&
    !host.endsWith('.') &&
    !host.includes('..')
  );
}
export function bindPublicAssets(data: PageData, apiOrigin: string): PageData {
  const bind = (value: string) => (isPublicMedia(value) ? new URL(value, apiOrigin).href : value);
  const listings = [...data.catalogue.listings, ...(data.results?.items || [])];
  if (data.entity && 'photos' in data.entity) listings.push(data.entity);
  for (const listing of listings) {
    listing.image = bind(listing.image);
    listing.photos = listing.photos.map(bind);
    listing.floorPlans = listing.floorPlans.map(bind);
  }
  for (const area of data.catalogue.areas) area.image = bind(area.image);
  if (data.entity && 'city' in data.entity) data.entity.image = bind(data.entity.image);
  return data;
}
