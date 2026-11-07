import type { Catalogue, Site } from './types.ts';

export const isAtelier = (site: Site) => site.kind === 'company' && site.theme === '1';
export const isHomeverse = (site: Site) => site.kind === 'company' && site.theme === '2';
export const isCompanyDesign = (site: Site) => isAtelier(site) || isHomeverse(site);
// Sample-only listing names per fictional company; Harbour keeps the approved preview names.
const titles: Record<string, string[]> = {
  harbour: [
    'Serenity Tower',
    'Island Retreat',
    'Mountain Lodge',
    'Composite Beach Lux',
    'Tulun Eco Retreat',
    'Azura Villa',
  ],
  cedar: [
    'Saadiyat Garden Townhouse',
    'Marina Skyline Apartment',
    'Cedar Court Townhouse',
    'Waterline Apartment',
    'Beachside Townhouse',
    'Marina Light Apartment',
  ],
};
const images = ['pavilion', 'residence', 'courtyard', 'interior', 'garden-house', 'terrace'];
export function companyDesignSample(catalogue: Catalogue): Catalogue {
  return {
    ...catalogue,
    listings: catalogue.listings.map((p, i) => ({
      ...p,
      title: (titles[p.company] || titles.harbour)[i % 6],
      image: `/company/${images[i % images.length]}.jpg`,
      photos: [
        images[i % images.length],
        ...['interior', 'terrace', 'courtyard'].filter((n) => n !== images[i % images.length]),
      ]
        .slice(0, 3)
        .map((name) => `/company/${name}.jpg`),
    })),
  };
}
