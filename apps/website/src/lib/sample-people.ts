import type { Company, Agent, Area } from './types.ts';
import { sampleAgentSocial } from './sample-social.ts';

export const sampleCompanies: Company[] = [
  {
    id: 'harbour',
    name: 'Harbour & Palm Realty',
    mark: 'HP',
    area: 'Dubai',
    note: 'Waterfront living. Considered service.',
  },
  {
    id: 'cedar',
    name: 'Cedar Gate Properties',
    mark: 'CG',
    area: 'Abu Dhabi',
    note: 'Spaces for the way you live.',
  },
  {
    id: 'dune',
    name: 'Dune & Coast Realty',
    mark: 'DC',
    area: 'Dubai',
    note: 'A fresh perspective on your next move.',
  },
];
export const sampleAgents: Agent[] = [
  ['maya', 'Maya Reed', 'harbour', 'Residential sales'],
  ['adam', 'Adam Cole', 'harbour', 'Residential leasing'],
  ['leila', 'Leila Brooks', 'cedar', 'Family homes'],
  ['omar', 'Omar Ellis', 'cedar', 'Apartments'],
  ['sara', 'Sara Lane', 'dune', 'Villas and townhouses'],
  ['james', 'James Hart', 'dune', 'Commercial property'],
].map(([id, name, company, specialty], i) => ({
  id,
  name,
  company,
  specialty,
  publicWhatsApp: `+44770090000${i + 1}`,
  publicEmail: `${id}@${company}.example`,
  ...(Object.hasOwn(sampleAgentSocial, id) && { social: sampleAgentSocial[id] }),
}));
export const sampleAreas: Area[] = [
  {
    id: 'marina',
    name: 'Dubai Marina',
    city: 'Dubai',
    emirate: 'dubai',
    image: '/property/apartment-interior.jpg',
    note: 'Waterfront walks and a lively city setting.',
  },
  {
    id: 'hills',
    name: 'Dubai Hills Estate',
    city: 'Dubai',
    emirate: 'dubai',
    image: '/property/villa-exterior.jpg',
    note: 'Open spaces and a quieter residential rhythm.',
  },
  {
    id: 'saadiyat',
    name: 'Saadiyat Island',
    city: 'Abu Dhabi',
    emirate: 'abu-dhabi',
    image: '/property/villa-exterior.jpg',
    note: 'Coastal living and places to explore.',
  },
];
