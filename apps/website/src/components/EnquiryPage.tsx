import Link from 'next/link';
import type { PageData } from '../lib/types';
import { ContactLinks, Heading, first } from './ui';
import { EnquiryForm } from './EnquiryForm';

export function EnquiryPage({ catalogue, query, site }: PageData) {
  const listingId = first(query.listing);
  const agentId = first(query.agent);
  const listing = catalogue.listings.find((item) => item.id === listingId);
  const agent = catalogue.agents.find((item) => item.id === (listing?.agent || agentId));
  const company = catalogue.companies.find(
    (item) => item.id === (agent?.company || first(query.company) || site.company),
  );
  const unavailable =
    (listingId && !listing) ||
    (agentId && !agent) ||
    (listing && agentId && listing.agent !== agentId);
  return (
    <section className="section page-top narrow-page">
      <Heading
        eyebrow="YOUR NEXT MOVE"
        title={unavailable ? 'This enquiry is unavailable.' : 'A conversation starts here.'}
        text={
          unavailable
            ? 'The property or representative is not available on this website.'
            : listing?.title ||
              (agent
                ? `Contact ${agent.name}`
                : 'Find a representative to discuss your requirements.')
        }
      />
      {unavailable ? (
        <Link className="button quiet" href="/properties">
          Browse available properties →
        </Link>
      ) : (
        <div className="enquiry-content">
          <h2>{agent?.name || 'Find your property professional.'}</h2>
          {company && <p className="muted">{company.name}</p>}
          {!site.sample && (listing || agent || company) ? (
            <EnquiryForm listingId={listing?.id} agentId={agent?.id} companyId={company?.id} />
          ) : (
            <p>
              {site.sample
                ? 'Sample enquiries are not sent or saved to the CRM.'
                : 'Choose a property, company or representative to send your enquiry.'}
            </p>
          )}
          {agent ? (
            <>
              <p>Use the representative’s published contact methods:</p>
              <ContactLinks agent={agent} listing={listing} />
              <Link className="button quiet" href={`/agents/${encodeURIComponent(agent.id)}`}>
                View agent profile →
              </Link>
            </>
          ) : (
            <Link className="button" href="/agents">
              Browse representatives →
            </Link>
          )}
          {listing && (
            <p>
              <Link href={`/properties/${encodeURIComponent(listing.id)}`}>
                ← Back to this property
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
