import fixtures from '../../generated/approved.json' with { type: 'json' };
import type { Catalogue, Listing } from '../types.ts';
import { sampleDevelopers } from '../sample-developers.ts';

// Illustrative developer associations for the six design-collection homes; not partnerships.
const illustrativeDevelopers = ['emaar', 'sobha', 'damac', 'nakheel', 'azizi', 'meraas'];

export function referenceSampleCatalogue(): Catalogue {
  const areas = [...new Set(fixtures.homes.map((p) => p.area))].map((name, index) => ({
    id: String(index),
    name,
    city: 'Dubai',
    emirate: 'dubai',
    image: '/approved/assets/villa.jpg',
    note: 'Illustrative community in the design collection.',
  }));
  const companies = fixtures.companies.map((c) => ({
    id: String(c.id),
    name: c.name,
    mark: c.mark,
    area: c.areas,
    note: c.tag,
  }));
  const agents = fixtures.people.map((a) => ({
    id: String(a.id),
    name: a.name,
    company: String(a.companyId),
    specialty: a.focus,
  }));
  const listings: Listing[] = fixtures.homes.map((p, index) => {
    const agent = fixtures.people.find((a) => a.name === p.agent)!;
    return {
      id: String(p.id),
      title: p.title,
      company: String(agent.companyId),
      agent: String(agent.id),
      developer: illustrativeDevelopers[index % illustrativeDevelopers.length],
      developerIllustrative: true,
      area: areas.find((a) => a.name === p.area)!.id,
      emirate: 'dubai',
      type: p.type,
      purpose: p.mode === 'Rent' ? 'rent' : 'buy',
      category: p.mode === 'Commercial' ? 'commercial' : 'residential',
      bedrooms: p.type === 'Office' ? null : p.beds,
      bathrooms: p.baths,
      size: Number(p.size.replaceAll(',', '')),
      price: p.price,
      image: `/approved/assets/${p.img}.jpg`,
      photos: [
        `/approved/assets/${p.img}.jpg`,
        '/approved/assets/living.jpg',
        '/approved/assets/bedroom.jpg',
        '/approved/assets/apartment.jpg',
      ],
      floorPlans: [],
      description: 'Illustrative property in the approved Blaqks One design collection.',
      ready: 'ready',
      furnishing: 'unfurnished',
      market: 'secondary',
      parking: 1,
      amenities: [],
      guests: 0,
      minimumStay: 0,
      publishedAt: '2026-11-05',
      reference: `BQ-${p.id.toString().padStart(4, '0')}`,
    };
  });
  return { listings, companies, agents, areas, developers: sampleDevelopers };
}
