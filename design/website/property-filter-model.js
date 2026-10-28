import { properties } from './data.js';
import { filterErrors, maxPrice } from './property-filter-validation.js';
export function filtered(ctx) {
  const q = ctx.query;
  if (filterErrors(q).length) return [];
  return properties.filter(
    (p) =>
      (!ctx.scope.site || p.company === ctx.scope.site) &&
      [
        'purpose',
        'emirate',
        'area',
        'type',
        'category',
        'company',
        'agent',
        'developer',
        'ready',
        'furnishing',
        'market',
      ].every((key) => !q.get(key) || p[key] === q.get(key)) &&
      (!q.get('minPrice') || p.price >= Number(q.get('minPrice'))) &&
      (!maxPrice(q) || p.price <= Number(maxPrice(q))) &&
      (!q.get('minSize') || p.size >= Number(q.get('minSize'))) &&
      (!q.get('maxSize') || p.size <= Number(q.get('maxSize'))) &&
      (!q.get('bedrooms') ||
        (p.category !== 'commercial' &&
          (q.get('bedrooms') === 'studio'
            ? p.bedrooms === 0
            : q.get('bedrooms') === '5plus'
              ? p.bedrooms >= 5
              : p.bedrooms === Number(q.get('bedrooms'))))) &&
      ['bathrooms', 'parking', 'guests'].every(
        (key) => !q.get(key) || p[key] >= Number(q.get(key)),
      ) &&
      (!q.get('nights') || p.minimumStay <= Number(q.get('nights'))) &&
      (q.get('amenities') || '')
        .split(',')
        .filter(Boolean)
        .every((value) => p.amenities.includes(value)) &&
      (!q.get('q') || p.title.toLowerCase().includes(q.get('q').trim().toLowerCase())),
  );
}
export function sortedProperties(items, q) {
  const order = q.get('sort') || 'newest';
  return items.toSorted((a, b) =>
    order === 'name'
      ? a.title.localeCompare(b.title)
      : order === 'price-asc'
        ? a.price - b.price
        : order === 'price-desc'
          ? b.price - a.price
          : order === 'size-asc'
            ? a.size - b.size
            : order === 'size-desc'
              ? b.size - a.size
              : b.publishedAt.localeCompare(a.publishedAt),
  );
}
