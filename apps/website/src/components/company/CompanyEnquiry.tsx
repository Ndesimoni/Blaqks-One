import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { EnquiryForm } from '../EnquiryForm';
import { ContactLinks, first, money, initials } from '../ui';
import { CompanySampleForm } from './CompanySampleForm';

export function CompanyEnquiry({ site, catalogue, query }: PageData) {
  const listingId = first(query.listing),
    agentId = first(query.agent),
    companyId = first(query.company);
  const listing = catalogue.listings.find((p) => p.id === listingId);
  const agent = catalogue.agents.find((a) => a.id === (listing?.agent || agentId));
  const company = catalogue.companies.find(
    (c) => c.id === (listing?.company || agent?.company || companyId || site.company),
  );
  const unavailable =
    !company ||
    (listingId && !listing) ||
    (agentId && !agent) ||
    (listing && agentId && listing.agent !== agentId) ||
    (companyId && company.id !== companyId);
  return (
    <div className="a-container a-inner">
      <p className="breadcrumb">
        <Link href={listing ? `/properties/${encodeURIComponent(listing.id)}` : '/contact'}>
          ← {listing ? 'Back to the property' : 'Contact our company'}
        </Link>
      </p>
      <section className="a-page-intro">
        <p className="a-kicker">YOUR NEXT STEP</p>
        <h1>
          {unavailable ? (
            'This enquiry is unavailable.'
          ) : (
            <>
              A conversation
              <br />
              starts here.
            </>
          )}
        </h1>
        <p>
          {unavailable
            ? 'The property or representative is not available on this website.'
            : listing
              ? 'Ask about availability, request a viewing or get the details that matter to you.'
              : 'Tell the team about your property requirements.'}
        </p>
      </section>
      {unavailable ? (
        <Link className="a-action" href="/properties">
          Browse available properties ↗
        </Link>
      ) : (
        <div className="a-enquiry-layout">
          <section className="a-enquiry-form-panel" aria-label="Enquiry form">
            {site.sample ? (
              <CompanySampleForm propertyTitle={listing?.title} agentName={agent?.name} />
            ) : (
              <EnquiryForm listingId={listing?.id} agentId={agent?.id} companyId={company.id} />
            )}
          </section>
          <aside className="a-enquiry-context">
            {listing && (
              <>
                <img src={listing.image} alt={listing.title} width={800} height={600} />
                <p className="a-kicker">YOUR SELECTED PROPERTY</p>
                <h2>{listing.title}</h2>
                <strong>{money(listing)}</strong>
                <p>Reference: {listing.reference}</p>
                <Link href={`/properties/${encodeURIComponent(listing.id)}`}>
                  View property details ↗
                </Link>
              </>
            )}
            <div className="a-enquiry-recipient">
              <p className="a-kicker">YOUR POINT OF CONTACT</p>
              {agent && (
                <>
                  <span className="avatar" aria-hidden="true">
                    {initials(agent.name)}
                  </span>
                  <h3>{agent.name}</h3>
                  <p>{agent.specialty}</p>
                </>
              )}
              <p>{company.name}</p>
              <ContactLinks agent={agent} listing={listing} />
              <p className="muted">
                A viewing is arranged only after the representative confirms the details with you.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
