import type { Developer } from './types.ts';

/** Developers with listings on this website first; the original order is kept otherwise. */
export const developersByListings = (developers: Developer[]) =>
  developers
    .map((developer, index) => ({ developer, index }))
    .sort(
      (a, b) =>
        Number((b.developer.publicListingCount || 0) > 0) -
          Number((a.developer.publicListingCount || 0) > 0) || a.index - b.index,
    )
    .map(({ developer }) => developer);
