export const images = {
  villa: 'assets/villa-exterior.jpg',
  apartment: 'assets/apartment-interior.jpg',
  office: 'assets/commercial-office.jpg',
};
export const companies = [
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
export const areas = [
  {
    id: 'marina',
    name: 'Dubai Marina',
    city: 'Dubai',
    image: images.apartment,
    note: 'Waterfront walks and a lively city setting.',
  },
  {
    id: 'hills',
    name: 'Dubai Hills Estate',
    city: 'Dubai',
    image: images.villa,
    note: 'Open spaces and a quieter residential rhythm.',
  },
  {
    id: 'saadiyat',
    name: 'Saadiyat Island',
    city: 'Abu Dhabi',
    image: images.villa,
    note: 'Coastal living and places to explore.',
  },
];
export const agents = [
  ['maya', 'Maya Reed', 'harbour', 'Residential sales'],
  ['adam', 'Adam Cole', 'harbour', 'Residential leasing'],
  ['leila', 'Leila Brooks', 'cedar', 'Family homes'],
  ['omar', 'Omar Ellis', 'cedar', 'Apartments'],
  ['sara', 'Sara Lane', 'dune', 'Villas and townhouses'],
  ['james', 'James Hart', 'dune', 'Commercial property'],
].map(([id, name, company, specialty]) => ({ id, name, company, specialty }));
export const properties = Array.from({ length: 18 }, (_, i) => {
  const agent = agents[i % agents.length];
  const area = areas[i % areas.length];
  const purpose = ['buy', 'rent', 'holiday'][Math.floor(i / 6)];
  const type = ['Apartment', 'Villa', 'Townhouse', 'Apartment', 'Villa', 'Office'][i % 6];
  return {
    id: String(i + 1),
    agent: agent.id,
    company: agent.company,
    area: area.id,
    title: `${type === 'Office' ? 'Light-filled office' : ['Waterfront residence', 'A home with room to grow', 'Considered contemporary living'][i % 3]} in ${area.name}`,
    type,
    purpose,
    bedrooms: type === 'Office' ? 0 : (i % 4) + 1,
    bathrooms: (i % 3) + 1,
    size: 1100 + i * 130,
    price:
      purpose === 'buy'
        ? 2450000 + i * 180000
        : purpose === 'rent'
          ? 120000 + i * 5000
          : 750 + i * 30,
    image:
      type === 'Office' ? images.office : type === 'Apartment' ? images.apartment : images.villa,
    ready: i % 4 === 0 ? 'off-plan' : 'ready',
  };
});
export const themeNames = ['Signature', 'Modern', 'Editorial', 'Nocturne'];
export const companyBy = (id) => companies.find((c) => c.id === id);
export const agentBy = (id) => agents.find((a) => a.id === id);
export const areaBy = (id) => areas.find((a) => a.id === id);
export const propertyBy = (id) => properties.find((p) => p.id === id);
