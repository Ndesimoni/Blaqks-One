import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { PropertyGrid } from '../Cards';
import { SearchForm } from '../SearchForm';
import { FeaturedAgents } from './FeaturedAgents';
import { PlatformOpportunities } from './PlatformOpportunities';

export function PlatformHome({ site, catalogue }: PageData) {
  return (
    <>
      <section className="platform-home-hero">
        <img
          src="/property/villa-exterior.jpg"
          alt="Illustrative contemporary villa with a pool"
          width="1800"
          height="1200"
          fetchPriority="high"
        />
        <div className="section platform-hero-content">
          <p className="eyebrow">EXCEPTIONAL HOMES. EXTRAORDINARY LIVING.</p>
          <h1>
            {site.content?.heroTitle || (
              <>
                Find a perfect
                <br />
                place to <em>live.</em>
              </>
            )}
          </h1>
          <p>
            {site.content?.heroSubtitle ||
              site.content?.tagline ||
              'Discover distinctive properties and connect with the professionals who help you make your next move.'}
          </p>
          <div className="platform-home-search">
            <h2 className="sr-only">Find your property</h2>
            <SearchForm catalogue={catalogue} compact />
          </div>
        </div>
      </section>
      <div className="section platform-benefits">
        {[
          ['⌂', 'Considered locations', 'Explore places that fit your life.'],
          ['◇', 'A personal search', 'Focus on the details that matter.'],
          ['◎', 'A clearer perspective', 'Compare properties on your terms.'],
          ['↗', 'Professional connections', 'Meet the people behind each listing.'],
        ].map(([icon, title, text]) => (
          <div key={title}>
            <span aria-hidden="true">{icon}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FEATURED PROPERTIES</p>
            <h2>Explore our best listings.</h2>
          </div>
          <Link href="/properties">View all properties →</Link>
        </div>
        {catalogue.listings.length ? (
          <PropertyGrid listings={catalogue.listings.slice(0, 3)} catalogue={catalogue} />
        ) : (
          <p className="notice">Published properties will appear here as they become available.</p>
        )}
      </section>
      <section className="section platform-story">
        <div>
          <p className="eyebrow">A CLEARER WAY FORWARD</p>
          <h2>
            We help you find
            <br />
            the right property.
          </h2>
          <p>
            Considered spaces, a personal search and the professionals behind your next chapter.
          </p>
          <Link className="button" href="/about">
            Discover Blaqks One →
          </Link>
        </div>
        <img
          src="/property/apartment-interior.jpg"
          alt="Illustrative contemporary living space"
          width="1000"
          height="750"
          loading="lazy"
        />
      </section>
      <PlatformOpportunities />
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A SETTING FOR YOUR LIFE</p>
            <h2>Explore the neighbourhoods.</h2>
          </div>
          <Link href="/areas">View all communities →</Link>
        </div>
        <div className="area-grid">
          {catalogue.areas.slice(0, 3).map((area) => (
            <Link
              className="area-card"
              key={area.id}
              href={`/areas/${encodeURIComponent(area.id)}`}
            >
              <img src={area.image} alt={area.name} width="600" height="450" loading="lazy" />
              <div>
                <h3>{area.name}</h3>
                <p>{area.city}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="platform-professional-banner">
        <div className="section">
          <p className="eyebrow">FOR AGENTS & COMPANIES</p>
          <h2>
            Your properties. Your relationships.
            <br />
            One connected workspace.
          </h2>
          <p>Bring your business and your next opportunity into focus.</p>
          <Link className="button" href="/professionals">
            Explore the professional workspace ↗
          </Link>
        </div>
      </section>
      <FeaturedAgents catalogue={catalogue} />
    </>
  );
}
