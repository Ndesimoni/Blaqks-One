import type { PageData } from '../types';

export function referenceQuery(data: PageData): string {
  if (data.site.sample) return new URLSearchParams(data.query as Record<string, string>).toString();
  const params = new URLSearchParams();
  const names: Record<string, string> = {
    minPrice: 'priceMin',
    maxPrice: 'priceMax',
    minSize: 'sizeMin',
    maxSize: 'sizeMax',
    bedrooms: 'beds',
    bathrooms: 'baths',
    furnishing: 'furnishing',
    ready: 'completion',
    q: 'q',
    type: 'type',
    amenities: 'amenities',
    sort: 'sort',
  };
  for (const [key, value] of Object.entries(data.query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item && names[key]) params.append(names[key], item === 'studio' ? '0' : item);
    }
  }
  if (data.query.purpose) params.set('purpose', data.query.purpose === 'rent' ? 'Rent' : 'Buy');
  if (data.query.category === 'commercial') params.set('purpose', 'Commercial');
  const area = data.catalogue.areas.find((a) => a.id === data.query.area);
  if (area) params.set('location', area.name);
  return params.toString();
}

export function publicFilterQuery(form: HTMLFormElement, data: PageData): URLSearchParams {
  const params = new URLSearchParams();
  const names: Record<string, string> = {
    priceMin: 'minPrice',
    priceMax: 'maxPrice',
    sizeMin: 'minSize',
    sizeMax: 'maxSize',
    beds: 'bedrooms',
    baths: 'bathrooms',
    furnishing: 'furnishing',
    completion: 'ready',
    q: 'q',
    type: 'type',
    amenities: 'amenities',
  };
  for (const [key, value] of new FormData(form)) {
    const text = String(value);
    if (!text) continue;
    if (names[key])
      params.append(
        names[key],
        key === 'beds' && text === '0' ? 'studio' : text.toLowerCase() === 'all' ? '' : text,
      );
    if (key === 'location') {
      const area = data.catalogue.areas.find((a) => a.name === text);
      if (area) params.set('area', area.id);
    }
    if (key === 'broker') {
      const company = data.catalogue.companies.find((c) => c.name === text);
      if (company) params.set('company', company.id);
    }
  }
  for (const key of ['furnishing', 'ready']) {
    const value = params.get(key);
    if (value) params.set(key, value.toLowerCase().replaceAll(' ', '-'));
  }
  const purpose = document.querySelector<HTMLElement>('[data-l-purpose][aria-pressed="true"]')
    ?.dataset.lPurpose;
  if (purpose === 'Rent') params.set('purpose', 'rent');
  if (purpose === 'Buy') params.set('purpose', 'buy');
  if (purpose === 'Commercial') params.set('category', 'commercial');
  const search = document.querySelector<HTMLInputElement>('#l-search')?.value;
  if (search) params.set('q', search);
  return params;
}
