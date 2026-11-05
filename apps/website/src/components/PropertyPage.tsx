import Link from 'next/link';
import type { Listing, PageData } from '../lib/types';
import { ContactLinks, initials, money } from './ui';
import { AreaMap } from './AreaMap';
import { PhotoGallery } from './PhotoGallery';
import { PropertyGrid } from './Cards';
import { ListingInformation } from './ListingInformation';

export function PropertyPage({ entity, catalogue }: PageData) {
  const listing = entity as Listing;
  const agent = catalogue.agents.find((item) => item.id === listing.agent);
  const company = catalogue.companies.find((item) => item.id === listing.company);
  const area = catalogue.areas.find((item) => item.id === listing.area);
  const developer = catalogue.developers.find((item) => item.id === listing.developer);
  const related = catalogue.listings
    .filter((item) => item.id !== listing.id && item.purpose === listing.purpose)
    .slice(0, 3);
  return (
    <section className="section page-top">
      <p className="breadcrumb">
        <Link href="/properties">← All properties</Link> / {area?.name || 'Property'}
      </p>
      <PhotoGallery photos={listing.photos} title={listing.title} />
      <div className="detail-layout">
        <div>
          <p className="eyebrow">
            {listing.purpose === 'buy'
              ? 'FOR SALE'
              : listing.purpose === 'rent'
                ? 'FOR RENT'
                : 'HOLIDAY HOME'}{' '}
            · {listing.ready === 'ready' ? 'READY' : 'OFF-PLAN'}
          </p>
          <h1 className="detail-title">{listing.title}</h1>
          <p className="muted">
            {area ? `${area.name}, ${area.city}` : 'Location details available from the agent'}
          </p>
          <p className="detail-price">{money(listing)}</p>
          <div className="detail-facts">
            <span>
              <b>
                {listing.category === 'commercial'
                  ? listing.type
                  : listing.bedrooms === 0
                    ? 'Studio'
                    : listing.bedrooms}
              </b>
              {listing.category === 'commercial'
                ? 'Property type'
                : listing.bedrooms === 0
                  ? 'Apartment'
                  : 'Bedrooms'}
            </span>
            <span>
              <b>{listing.bathrooms}</b>Bathrooms
            </span>
            <span>
              <b>{listing.size.toLocaleString()}</b>sqft
            </span>
          </div>
          <div className="detail-quick-contact">
            <Link className="button" href={`/enquiry?listing=${encodeURIComponent(listing.id)}`}>
              Enquire about this property →
            </Link>
            <ContactLinks agent={agent} listing={listing} />
          </div>
          <nav className="anchor-nav" aria-label="Property sections">
            <a href="#overview">Overview</a>
            <a href="#features">Features</a>
            <a href="#location">Location</a>
            <a href="#details">Listing details</a>
          </nav>
          <section className="detail-section" id="overview">
            <h2>A space to make your own.</h2>
            <p>{listing.description}</p>
          </section>
          <section className="detail-section" id="features">
            <h2>The details that make a home.</h2>
            {listing.amenities.length ? (
              <ul className="amenities">
                {listing.amenities.map((amenity) => (
                  <li key={amenity}>{amenity.replaceAll('-', ' ')}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Amenities have not been supplied.</p>
            )}
            <h3>Floor plans</h3>
            {listing.floorPlans.length ? (
              <ul>
                {listing.floorPlans.map((plan, index) => (
                  <li key={plan}>
                    <a href={plan} target="_blank" rel="noopener noreferrer">
                      View floor plan {index + 1} →
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No floor plan is supplied for this property.</p>
            )}
          </section>
          <AreaMap area={area} listing={listing.id} />
          <ListingInformation
            listing={listing}
            agent={agent}
            company={company}
            developer={developer}
          />
        </div>
        {agent && (
          <aside className="enquiry-panel">
            <span className="avatar" aria-hidden="true">
              {initials(agent.name)}
            </span>
            <p className="eyebrow">YOUR LISTING REPRESENTATIVE</p>
            <h2>{agent.name}</h2>
            <p>{company?.name}</p>
            <p className="muted">
              Ask about this property. Your enquiry belongs to the company representing it.
            </p>
            <Link className="button" href={`/enquiry?listing=${encodeURIComponent(listing.id)}`}>
              Enquire about this property →
            </Link>
            <ContactLinks agent={agent} listing={listing} />
            <Link href={`/agents/${encodeURIComponent(agent.id)}`}>View agent profile →</Link>
          </aside>
        )}
      </div>
      {related.length > 0 && (
        <>
          <div className="section-heading">
            <h2>More places to consider.</h2>
            <Link href="/properties">Explore properties →</Link>
          </div>
          <PropertyGrid listings={related} catalogue={catalogue} />
        </>
      )}
    </section>
  );
}
