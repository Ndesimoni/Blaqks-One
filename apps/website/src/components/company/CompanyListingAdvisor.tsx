import Link from 'next/link';
import type { Catalogue, Listing } from '../../lib/types';
import { ContactLinks, initials } from '../ui';

export function CompanyListingAdvisor({
  listing,
  catalogue,
}: {
  listing: Listing;
  catalogue: Catalogue;
}) {
  const agent = catalogue.agents.find((a) => a.id === listing.agent);
  const company = catalogue.companies.find((c) => c.id === listing.company);
  if (!agent) return null;
  return (
    <section className="detail-section a-listing-advisor">
      <p className="a-kicker">THE PEOPLE BEHIND THE PROPERTY</p>
      <h2>Listed by {company?.name}.</h2>
      <div>
        <span className="avatar" aria-hidden="true">
          {initials(agent.name)}
        </span>
        <div>
          <h3>{agent.name}</h3>
          <p>{agent.specialty}</p>
          <Link href={`/agents/${encodeURIComponent(agent.id)}`}>View advisor profile ↗</Link>
          <ContactLinks agent={agent} listing={listing} />
        </div>
      </div>
    </section>
  );
}
