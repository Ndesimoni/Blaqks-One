import type { Query } from './types.ts';

export const first = (query: Query, key: string) => {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value) || '';
};
export function queryParams(query: Query): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.filter(Boolean).forEach((v) => params.append(key, v));
    else if (value) params.set(key, value);
  }
  return params;
}
export const selectedAmenities = (query: Query) =>
  queryParams(query)
    .getAll('amenities')
    .flatMap((v) => v.split(','))
    .filter(Boolean);
