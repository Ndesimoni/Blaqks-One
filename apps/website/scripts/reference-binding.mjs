import { homes } from './estate.js';
import { people } from './agent-components.js';
import { companies } from './public-pages.js';
import { dealData } from './deal-data.js';
import { referenceIdentity } from './reference-identity.ts';

const originals = structuredClone({ homes, people, companies, dealData });
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function bind(data) {
  window.__blaqksReference = data;
  if (data.site.sample) {
    homes.splice(0, homes.length, ...structuredClone(originals.homes));
    people.splice(0, people.length, ...structuredClone(originals.people));
    companies.splice(0, companies.length, ...structuredClone(originals.companies));
    Object.assign(dealData, originals.dealData);
    return;
  }
  const identity = (kind, id) => referenceIdentity(data.site.id + ':' + kind, id, false);
  const source = data.catalogue;
  companies.splice(
    0,
    companies.length,
    ...source.companies.map((c) => ({
      id: identity('company', c.id),
      name: escape(c.name),
      mark: escape(c.mark),
      tag: escape(c.note),
      focus: escape(c.note),
      areas: escape(c.area),
      img: 'villa',
    })),
  );
  people.splice(
    0,
    people.length,
    ...source.agents.map((a) => {
      const company = source.companies.find((c) => c.id === a.company);
      return {
        id: identity('agent', a.id),
        name: escape(a.name),
        company: escape(company?.name),
        initials: escape(
          a.name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join(''),
        ),
        focus: escape(a.specialty),
        area: escape(company?.area),
        companyId: identity('company', a.company),
      };
    }),
  );
  homes.splice(
    0,
    homes.length,
    ...source.listings.map((p) => {
      const agent = source.agents.find((a) => a.id === p.agent);
      const company = source.companies.find((c) => c.id === p.company);
      const area = source.areas.find((a) => a.id === p.area);
      return {
        id: identity('property', p.id),
        publicId: p.id,
        title: escape(p.title),
        area: escape(area?.name),
        type: escape(p.type),
        mode: p.purpose === 'rent' ? 'Rent' : p.category === 'commercial' ? 'Commercial' : 'Buy',
        price: p.price,
        img: 'villa',
        imageURL: escape(p.image),
        photos: p.photos.map(escape),
        beds: p.bedrooms ?? 0,
        baths: p.bathrooms,
        size: p.size.toLocaleString(),
        agent: escape(agent?.name),
        agentId: identity('agent', p.agent),
        company: escape(company?.name),
        description: escape(p.description),
        reference: escape(p.reference),
        publicMeta: {
          amenities: p.amenities.map(escape),
          furnishing: escape(p.furnishing),
          completion: escape(p.ready),
          status: 'Not supplied',
          floorPlan: p.floorPlans[0] ? escape(p.floorPlans[0]) : null,
        },
      };
    }),
  );
  for (const key of Object.keys(dealData)) delete dealData[key];
}
