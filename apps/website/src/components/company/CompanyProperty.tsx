import Link from 'next/link';
import type { Listing, PageData } from '../../lib/types';
import { CompanyListingMedia } from './CompanyListingMedia';
import { CompanyListingAdvisor } from './CompanyListingAdvisor';
import { CompanyMobileContact } from './CompanyMobileContact';
import { PhotoGallery } from '../PhotoGallery';
import { AreaMap } from '../AreaMap';
import { ListingInformation } from '../ListingInformation';
import { ContactLinks, money, initials } from '../ui';
import { CompanyGrid } from './CompanyCards';
import { amenities, optionLabel } from '../../lib/options';

export function CompanyProperty({ entity, catalogue }: PageData) {
  const p = entity as Listing;
  const agent = catalogue.agents.find((a) => a.id === p.agent);
  const company = catalogue.companies.find((c) => c.id === p.company);
  const area = catalogue.areas.find((a) => a.id === p.area);
  const developer = catalogue.developers.find((d) => d.id === p.developer);
  const related = catalogue.listings
    .filter((l) => l.id !== p.id && l.purpose === p.purpose)
    .slice(0, 3);
  return (
    <div className="a-container a-inner a-property-page">
      <p className="breadcrumb">
        <Link href="/properties">← Back to the collection</Link> / {area?.name || p.emirate}
      </p>
      <div className="a-property-title">
        <div>
          <p className="a-kicker">
            {p.purpose === 'buy' ? 'FOR SALE' : p.purpose === 'rent' ? 'TO RENT' : 'HOLIDAY HOME'} ·{' '}
            {p.type}
          </p>
          <h1>{p.title}</h1>
          <p>
            {area?.name}, {area?.city || p.emirate}
          </p>
        </div>
        <strong>{money(p)}</strong>
      </div>
      <PhotoGallery photos={p.photos} title={p.title} />
      <div className="detail-layout">
        <div>
          <div className="detail-facts">
            <span>
              <b>{p.bedrooms === null ? 'Commercial' : p.bedrooms === 0 ? 'Studio' : p.bedrooms}</b>
              {p.bedrooms === null
                ? 'Property category'
                : p.bedrooms === 0
                  ? 'Layout'
                  : p.bedrooms === 1
                    ? 'Bedroom'
                    : 'Bedrooms'}
            </span>
            <span>
              <b>{p.bathrooms}</b>
              {p.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
            </span>
            <span>
              <b>{p.size.toLocaleString('en-AE')}</b>Square feet
            </span>
            {p.parking > 0 && (
              <span>
                <b>{p.parking}</b>
                {p.parking === 1 ? 'Parking space' : 'Parking spaces'}
              </span>
            )}
          </div>
          <nav className="anchor-nav" aria-label="Property sections">
            <a href="#overview">Overview</a>
            <a href="#features">Features</a>
            <a href="#location">Location</a>
            <a href="#details">Details</a>
          </nav>
          <section className="detail-section" id="overview">
            <p className="a-kicker">THE SPACE</p>
            <h2>Picture your life here.</h2>
            <p>{p.description}</p>
          </section>
          <section className="detail-section" id="features">
            <p className="a-kicker">THE FINER DETAILS</p>
            <h2>Made for the way you live.</h2>
            {p.amenities.length ? (
              <ul className="amenities">
                {p.amenities.map((a) => (
                  <li key={a}>{optionLabel(amenities, a)}</li>
                ))}
              </ul>
            ) : (
              <p>Amenities have not been supplied.</p>
            )}
          </section>
          <CompanyListingMedia listing={p} />
          <AreaMap area={area} listing={p.id} />
          <ListingInformation listing={p} agent={agent} company={company} developer={developer} />
          <CompanyListingAdvisor listing={p} catalogue={catalogue} />
        </div>
        <aside className="enquiry-panel">
          <p className="a-kicker">YOUR PERSONAL POINT OF CONTACT</p>
          {agent && (
            <>
              <span className="avatar">{initials(agent.name)}</span>
              <h2>{agent.name}</h2>
              <p>{agent.specialty}</p>
              <p className="muted">{company?.name}</p>
            </>
          )}
          <p>Ask about availability, arrange a viewing or talk through the details.</p>
          <Link className="button" href={`/enquiry?listing=${encodeURIComponent(p.id)}`}>
            Request a viewing ↗
          </Link>
          <ContactLinks agent={agent} listing={p} />
          {agent && (
            <Link href={`/agents/${encodeURIComponent(agent.id)}`}>Meet your advisor ↗</Link>
          )}
          <small>Reference: {p.reference}</small>
        </aside>
      </div>
      <CompanyMobileContact listing={p} />
      {!!related.length && (
        <section className="a-section">
          <div className="a-section-head">
            <h2>A few more possibilities.</h2>
            <Link href="/properties">All properties ↗</Link>
          </div>
          <CompanyGrid catalogue={catalogue} listings={related} />
        </section>
      )}
    </div>
  );
}
