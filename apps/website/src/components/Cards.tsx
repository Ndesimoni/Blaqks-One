import Link from 'next/link';
import type { Agent, Catalogue, Company, Listing } from '../lib/types';
import { ContactLinks, bedrooms, count, initials, money } from './ui';

export function PropertyCard({ listing, catalogue }: { listing: Listing; catalogue: Catalogue }) {
  const agent = catalogue.agents.find((item) => item.id === listing.agent);
  const area = catalogue.areas.find((item) => item.id === listing.area);
  const developer = catalogue.developers.find((item) => item.id === listing.developer);
  return (
    <article className="property-card">
      <Link className="property-image" href={`/properties/${encodeURIComponent(listing.id)}`}>
        <img src={listing.image} alt={listing.title} width="720" height="480" loading="lazy" />
        <span className="property-badge">
          {listing.purpose === 'buy'
            ? 'For sale'
            : listing.purpose === 'rent'
              ? 'For rent'
              : 'Holiday home'}
        </span>
      </Link>
      <div className="card-content">
        <p className="price">{money(listing)}</p>
        <h3>
          <Link href={`/properties/${encodeURIComponent(listing.id)}`}>{listing.title}</Link>
        </h3>
        <p className="muted">
          {area ? `${area.name}, ${area.city}` : 'Area details available from the agent'}
        </p>
        <p className="property-facts">
          {listing.category === 'commercial' ? listing.type : bedrooms(listing)}
          <span>{count(listing.bathrooms, 'bath')}</span>
          <span>{listing.size.toLocaleString('en-AE')} sq ft</span>
        </p>
        {developer && (
          <small className="muted card-developer">
            Developer:{' '}
            <Link href={`/developers/${encodeURIComponent(developer.id)}`}>{developer.name}</Link>
            {listing.developerIllustrative && ' (illustrative)'}
          </small>
        )}
        {agent && (
          <Link className="listing-agent" href={`/agents/${encodeURIComponent(agent.id)}`}>
            Listed by {agent.name} <span aria-hidden="true">→</span>
          </Link>
        )}
        <ContactLinks agent={agent} listing={listing} />
      </div>
    </article>
  );
}
export function PropertyGrid({
  listings,
  catalogue,
}: {
  listings: Listing[];
  catalogue: Catalogue;
}) {
  return (
    <div className="property-grid">
      {listings.map((listing) => (
        <PropertyCard key={listing.id} listing={listing} catalogue={catalogue} />
      ))}
    </div>
  );
}
export function AgentCard({ agent, catalogue }: { agent: Agent; catalogue: Catalogue }) {
  const company = catalogue.companies.find((item) => item.id === agent.company);
  return (
    <article className="person-card">
      <span className="avatar" aria-hidden="true">
        {initials(agent.name)}
      </span>
      <p className="eyebrow">{agent.specialty}</p>
      <h3>
        <Link href={`/agents/${encodeURIComponent(agent.id)}`}>{agent.name}</Link>
      </h3>
      <p className="muted">{company?.name}</p>
      {agent.publicListingCount !== undefined && (
        <p>{count(agent.publicListingCount, 'public listing')}</p>
      )}
      <ContactLinks agent={agent} />
      <Link href={`/agents/${encodeURIComponent(agent.id)}`}>View profile & properties →</Link>
    </article>
  );
}
export function CompanyCard({ company, catalogue }: { company: Company; catalogue: Catalogue }) {
  return (
    <article className="person-card">
      <span className="avatar" aria-hidden="true">
        {company.mark}
      </span>
      <p className="eyebrow">{company.area}</p>
      <h3>
        <Link href={`/companies/${encodeURIComponent(company.id)}`}>{company.name}</Link>
      </h3>
      <p className="muted">{company.note}</p>
      {company.publicListingCount !== undefined && (
        <p>{count(company.publicListingCount, 'public listing')}</p>
      )}
      {company.publicAgentCount !== undefined && (
        <p>{count(company.publicAgentCount, 'agent')} with public listings</p>
      )}
      <Link href={`/companies/${encodeURIComponent(company.id)}`}>View company & properties →</Link>
    </article>
  );
}
