export const photo = (id, width = 1200) =>
  'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + width + '&q=85';

export const images = {
  villa: photo('photo-1613977257363-707ba9348227'),
  apartment: photo('photo-1600210492486-724fe5c67fb0'),
  living: photo('photo-1600607687920-4e2a09cf159d'),
  office: photo('photo-1497366754035-f200968a6e72'),
};

export const companies = [
  { id: 1, name: 'Coastal & Co.', focus: 'Waterfront homes & residential sales' },
  { id: 2, name: 'Avenue Properties', focus: 'City residences & leasing' },
];

export const agents = [
  { id: 1, name: 'Alex Morgan', company: 1, area: 'Palm Jumeirah', focus: 'Waterfront homes' },
  { id: 2, name: 'Jordan Lee', company: 2, area: 'Downtown Dubai', focus: 'City residences' },
  { id: 3, name: 'Casey Taylor', company: 1, area: 'Business Bay', focus: 'Commercial property' },
  { id: 4, name: 'Morgan Reed', company: 2, area: 'Al Furjan', focus: 'Apartment rentals' },
  { id: 5, name: 'Avery Lane', company: 1, area: 'Dubai Hills Estate', focus: 'Family homes' },
  { id: 6, name: 'Jamie Rivers', company: 2, area: 'Downtown Dubai', focus: 'Residential sales' },
];

export const properties = [
  {
    id: 1, title: 'Contemporary waterfront villa', area: 'Palm Jumeirah',
    type: 'Villa', purpose: 'Buy', price: 18500000, beds: 5, baths: 6,
    size: 7200, image: 'villa', company: 1, agent: 1, status: 'Available',
    furnishing: 'Unfurnished', completion: 'Ready', deal: 'Distress', reference: 20000000,
    amenities: ['Pool', 'Garden', 'Parking', 'Balcony'],
  },
  {
    id: 2, title: 'Skyline residence', area: 'Downtown Dubai',
    type: 'Apartment', purpose: 'Rent', price: 240000, beds: 2, baths: 3,
    size: 1650, image: 'apartment', company: 2, agent: 2, status: 'Available',
    furnishing: 'Furnished', completion: 'Ready', deal: 'Discount', reference: 270000,
    amenities: ['Gym', 'Parking', 'Balcony'],
  },
  {
    id: 3, title: 'A new perspective on business', area: 'Business Bay',
    type: 'Office', purpose: 'Buy', price: 3950000, beds: 0, baths: 2,
    size: 2400, image: 'office', company: 1, agent: 3, status: 'Available',
    furnishing: 'Unfurnished', completion: 'Ready', deal: 'Distress', reference: 4300000,
    amenities: ['Parking', 'Reception'],
  },
  {
    id: 4, title: 'The urban studio', area: 'Al Furjan',
    type: 'Apartment', purpose: 'Rent', price: 72000, beds: 0, baths: 1,
    size: 480, image: 'living', company: 2, agent: 4, status: 'Available',
    furnishing: 'Furnished', completion: 'Ready', deal: 'Discount', reference: 80000,
    amenities: ['Parking', 'Balcony'],
  },
  {
    id: 5, title: 'A residence above the city', area: 'Downtown Dubai',
    type: 'Apartment', purpose: 'Buy', price: 1850000, beds: 1, baths: 2,
    size: 920, image: 'apartment', company: 2, agent: 6, status: 'Under offer',
    furnishing: 'Partly furnished', completion: 'Ready', deal: 'Distress', reference: 2100000,
    amenities: ['Pool', 'Parking', 'Balcony'],
  },
  {
    id: 6, title: 'Garden terrace townhouse', area: 'Dubai Hills Estate',
    type: 'Townhouse', purpose: 'Buy', price: 4200000, beds: 3, baths: 4,
    size: 2650, image: 'villa', company: 1, agent: 5, status: 'Sold',
    furnishing: 'Unfurnished', completion: 'Off-plan', deal: 'Discount', reference: 4500000,
    amenities: ['Garden', 'Parking', 'Balcony'],
  },
];

export const money = n => 'AED ' + Number(n).toLocaleString('en-AE');
export const companyFor = p => companies.find(c => c.id === p.company);
export const agentFor = p => agents.find(a => a.id === p.agent);
export const ref = p => 'BQ-' + String(p.id).padStart(4, '0');
export const saving = p => Math.round((1 - p.price / p.reference) * 100);
export const price = p => money(p.price) + (p.purpose === 'Rent' ? ' / year' : '');
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
