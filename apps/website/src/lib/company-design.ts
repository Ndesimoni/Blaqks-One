import type { Catalogue, Site } from './types.ts';

export const isAtelier = (site: Site) => site.kind === 'company' && site.theme === '1';
export const isHomeverse = (site: Site) => site.kind === 'company' && site.theme === '2';
export const isCompanyDesign = (site: Site) => isAtelier(site) || isHomeverse(site);
const titles = [
  'Serenity Tower',
  'Island Retreat',
  'Mountain Lodge',
  'Composite Beach Lux',
  'Tulun Eco Retreat',
  'Azura Villa',
];
const images = ['hero', 'residence', 'courtyard', 'interior', 'villa', 'terrace'];
export function companyDesignSample(catalogue: Catalogue): Catalogue {
  return {
    ...catalogue,
    listings: catalogue.listings.map((p, i) => ({
      ...p,
      title: titles[i % titles.length],
      image: `/company/${images[i % images.length]}.jpg`,
      photos: [
        `/company/${images[i % images.length]}.jpg`,
        '/company/interior.jpg',
        '/company/terrace.jpg',
      ],
    })),
  };
}
