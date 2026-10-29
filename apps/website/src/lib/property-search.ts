import type { Catalogue, Listing, Query, Results } from './types.ts';
import { first, selectedAmenities } from './query.ts';
import { filterErrors } from './filter-validation.ts';

export function searchProperties(catalogue: Catalogue, query: Query): Results {
  const errors = filterErrors(query, catalogue),
    get = (key: string) => first(query, key);
  const items = errors.length
    ? []
    : catalogue.listings.filter((p) => {
        if (
          ![
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
          ].every((key) => !get(key) || p[key as keyof Listing] === get(key))
        )
          return false;
        for (const [field, prop, direction] of [
          ['minPrice', 'price', 1],
          ['maxPrice', 'price', -1],
          ['minSize', 'size', 1],
          ['maxSize', 'size', -1],
        ] as const)
          if (get(field) && (p[prop] - Number(get(field))) * direction < 0) return false;
        if (
          get('bedrooms') &&
          (p.category === 'commercial' ||
            (get('bedrooms') === 'studio'
              ? p.bedrooms !== 0
              : get('bedrooms') === '5plus'
                ? (p.bedrooms || 0) < 5
                : p.bedrooms !== Number(get('bedrooms'))))
        )
          return false;
        if (
          !(['bathrooms', 'parking', 'guests'] as const).every(
            (key) => !get(key) || p[key] >= Number(get(key)),
          )
        )
          return false;
        if (get('nights') && p.minimumStay > Number(get('nights'))) return false;
        return (
          selectedAmenities(query).every((a) => p.amenities.includes(a)) &&
          (!get('q') || p.title.toLowerCase().includes(get('q').trim().toLowerCase()))
        );
      });
  const sort = get('sort');
  items.sort((a, b) =>
    sort === 'name'
      ? a.title.localeCompare(b.title)
      : sort === 'price-asc'
        ? a.price - b.price
        : sort === 'price-desc'
          ? b.price - a.price
          : sort === 'size-asc'
            ? a.size - b.size
            : sort === 'size-desc'
              ? b.size - a.size
              : b.publishedAt.localeCompare(a.publishedAt),
  );
  const requested = /^\d+$/.test(get('page')) ? Number(get('page')) : 1;
  const page = Math.min(Math.max(1, requested), Math.max(1, Math.ceil(items.length / 12)));
  return {
    items: items.slice((page - 1) * 12, page * 12),
    total: items.length,
    page,
    pageSize: 12,
    errors,
  };
}
