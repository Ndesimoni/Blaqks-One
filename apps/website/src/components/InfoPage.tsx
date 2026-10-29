import Link from 'next/link';
import type { PageData } from '../lib/types';
import { Heading } from './ui';

export function InfoPage({ page, site, catalogue }: PageData) {
  const legal = page === 'privacy' || page === 'terms';
  const title =
    page === 'privacy'
      ? 'Privacy notice.'
      : page === 'terms'
        ? 'Website terms.'
        : page === 'contact'
          ? 'Let’s talk about your next move.'
          : 'Property. With perspective.';
  const company = catalogue.companies.find((item) => item.id === site.company);
  return (
    <section className="section page-top">
      <Heading
        eyebrow={legal ? 'WEBSITE INFORMATION' : site.name}
        title={title}
        text={
          legal
            ? 'This content is not a final legal policy.'
            : page === 'contact'
              ? 'Find the right person for your property question.'
              : site.content?.tagline ||
                company?.note ||
                'Connecting places, people and their next chapter.'
        }
      />
      {legal ? (
        <div className="prose">
          <h2>Policy content is being prepared.</h2>
          <p>
            The final{' '}
            {page === 'privacy'
              ? 'privacy notice, including data handling, retention and contact information,'
              : 'website terms and applicable service conditions'}{' '}
            must be supplied before this website is launched publicly.
          </p>
          <p>
            {site.sample
              ? 'This sample website does not send enquiry forms or publish CRM records.'
              : 'Property enquiries are received by the company representing the property. Final policy content must be configured before public launch.'}
          </p>
          <Link href="/contact">Contact information →</Link>
        </div>
      ) : page === 'contact' ? (
        <div className="contact-layout">
          <div className="prose">
            <p className="eyebrow">A PERSONAL INTRODUCTION</p>
            <h2>Start with the right conversation.</h2>
            <p>
              {site.content?.contactText ||
                'For a property enquiry, contact the named listing agent from the property page. For broader requirements, browse our professionals and choose a representative.'}
            </p>
            <Link className="button" href="/agents">
              Find a representative →
            </Link>
            {site.kind === 'company' && !site.sample ? (
              <Link className="button quiet" href="/enquiry">
                Send a company enquiry →
              </Link>
            ) : (
              <p className="muted">Choose a representative to discuss your enquiry.</p>
            )}
          </div>
          <img
            src="/property/apartment-interior.jpg"
            alt="Illustrative living space"
            width="1000"
            height="750"
            loading="lazy"
          />
        </div>
      ) : (
        <>
          <div className="editorial-block">
            <img
              src="/property/villa-exterior.jpg"
              alt="Illustrative villa exterior"
              width="1000"
              height="750"
            />
            <div className="prose">
              <p className="eyebrow">OUR PERSPECTIVE</p>
              <h2>
                The next chapter
                <br />
                starts with a place.
              </h2>
              <p>
                {site.content?.about ||
                  'Explore public property listings, learn about the companies and people representing them, and make contact with the right professional.'}
              </p>
              <p>
                We put clear property information and named representatives at the centre of the
                experience.
              </p>
              <Link className="button quiet" href="/properties">
                Explore properties →
              </Link>
            </div>
          </div>
          <div className="values-grid">
            <div>
              <h3>Find your setting.</h3>
              <p>Search by emirate, community, property type and budget.</p>
            </div>
            <div>
              <h3>Know your representative.</h3>
              <p>Each listing identifies the agent and company behind it.</p>
            </div>
            <div>
              <h3>Make your next move.</h3>
              <p>Ask the listing agent about availability and the details that matter.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
