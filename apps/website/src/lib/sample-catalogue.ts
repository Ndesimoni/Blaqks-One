import type { Catalogue, Listing, Site } from './types.ts';
import { sampleCompanies, sampleAgents, sampleAreas } from './sample-people.ts';
import { sampleDevelopers } from './sample-developers.ts';

const listings: Listing[] = Array.from({ length: 18 }, (_, i) => {
  const agent = sampleAgents[i % 6],
    area = sampleAreas[i % 3];
  const purpose = ['buy', 'rent', 'holiday'][Math.floor(i / 6)];
  const base = ['Apartment', 'Villa', 'Townhouse', 'Apartment', 'Villa', 'Office'][i % 6];
  const type = purpose === 'holiday' && base === 'Office' ? 'Apartment' : base;
  const commercial = type === 'Office',
    bedrooms = commercial ? null : i % 6 === 0 ? 0 : (i % 4) + 1;
  const parking = i % 3 === 0 ? 0 : type === 'Villa' ? 2 : 1;
  const amenities =
    type === 'Villa' ? ['garden', 'pool', 'maids-room'] : commercial ? [] : ['balcony', 'gym'];
  if (parking) amenities.push('parking');
  const image = `/property/${commercial ? 'commercial-office' : type === 'Apartment' ? 'apartment-interior' : 'villa-exterior'}.jpg`;
  return {
    id: String(i + 1),
    agent: agent.id,
    company: agent.company,
    area: area.id,
    emirate: area.emirate,
    developer: ['emaar', 'sobha', 'aldar', 'nakheel', 'azizi', 'reportage'][i % 6],
    developerIllustrative: true,
    title: `${commercial ? 'Light-filled office' : ['Waterfront residence', 'A home with room to grow', 'Considered contemporary living'][i % 3]} in ${area.name}`,
    type,
    purpose,
    category: commercial ? 'commercial' : 'residential',
    bedrooms,
    bathrooms: (i % 3) + 1,
    size: 1100 + i * 130,
    price:
      purpose === 'buy'
        ? 2450000 + i * 180000
        : purpose === 'rent'
          ? 120000 + i * 5000
          : 750 + i * 30,
    image,
    photos: [image, '/property/apartment-interior.jpg', '/property/villa-exterior.jpg'],
    floorPlans: [],
    description:
      'A fictional property presentation with considered living spaces. Photography and developer associations are illustrative, not an actual listing.',
    parking,
    amenities,
    furnishing: ['furnished', 'unfurnished', 'part-furnished'][i % 3],
    ready: purpose === 'buy' && i % 4 === 0 ? 'off-plan' : 'ready',
    market: purpose === 'buy' ? (i % 2 === 0 ? 'primary' : 'resale') : '',
    guests: purpose === 'holiday' ? Math.max(2, (bedrooms || 0) * 2) : 0,
    minimumStay: purpose === 'holiday' ? (i % 3) + 1 : 0,
    publishedAt: new Date(Date.UTC(2026, 9, 28 - i)).toISOString(),
    reference: `SAMPLE-${i + 1}`,
  };
});

export function sampleCatalogue(site: Site): Catalogue {
  const companies = sampleCompanies.filter((c) => !site.company || c.id === site.company);
  const stock = listings.filter((p) => !site.company || p.company === site.company);
  return {
    listings: stock,
    companies: companies.map((c) => ({
      ...c,
      publicListingCount: stock.filter((p) => p.company === c.id).length,
      publicAgentCount: new Set(stock.filter((p) => p.company === c.id).map((p) => p.agent)).size,
    })),
    agents: sampleAgents
      .filter((a) => !site.company || a.company === site.company)
      .map((a) => ({ ...a, publicListingCount: stock.filter((p) => p.agent === a.id).length })),
    areas: sampleAreas
      .filter((area) => !site.company || stock.some((p) => p.area === area.id))
      .map((a) => ({ ...a, publicListingCount: stock.filter((p) => p.area === a.id).length })),
    developers: sampleDevelopers.map((d) => ({
      ...d,
      publicListingCount: stock.filter((p) => p.developer === d.id).length,
    })),
  };
}
