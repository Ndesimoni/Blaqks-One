import Link from 'next/link';
import type { PageData } from '../lib/types';
import { SearchForm } from './SearchForm';
import { AgentCard, PropertyGrid } from './Cards';
import { HomeHero } from './HomeHero';

export function HomePage({ site, catalogue }: PageData) {
  return (
    <>
      <HomeHero site={site} catalogue={catalogue} />
      <section className="home-search section">
        <h2 className="sr-only">Find your property</h2>
        <SearchForm catalogue={catalogue} compact />
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A PLACE TO BEGIN</p>
            <h2>Find your next chapter.</h2>
          </div>
          <Link href="/properties">View all properties →</Link>
        </div>
        <PropertyGrid listings={catalogue.listings.slice(0, 6)} catalogue={catalogue} />
      </section>
      <section className="section editorial-block">
        <img
          src="/property/apartment-interior.jpg"
          alt="Illustrative contemporary living space"
          width="1000"
          height="750"
          loading="lazy"
        />
        <div>
          <p className="eyebrow">PROPERTY. WITH PERSPECTIVE.</p>
          <h2>
            Good places.
            <br />
            The right people.
          </h2>
          <p className="muted">
            A home is more than an address. Explore the properties, communities and professionals
            behind your next move.
          </p>
          <Link className="button quiet" href="/about">
            Our approach →
          </Link>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KNOW THE NEIGHBOURHOOD</p>
            <h2>A setting for your life.</h2>
          </div>
          <Link href="/areas">Explore communities →</Link>
        </div>
        <div className="area-grid">
          {catalogue.areas.map((area) => (
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
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PEOPLE WHO GUIDE YOU</p>
            <h2>
              {site.kind === 'platform' ? 'Meet the professionals.' : 'A personal introduction.'}
            </h2>
          </div>
          <Link href="/agents">Meet the team →</Link>
        </div>
        <div className="people-grid">
          {catalogue.agents.slice(0, 3).map((agent) => (
            <AgentCard key={agent.id} agent={agent} catalogue={catalogue} />
          ))}
        </div>
      </section>
      <section className="section developers-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE PEOPLE SHAPING THE UAE</p>
            <h2>Discover the developers.</h2>
          </div>
          <Link href="/developers">View all developers →</Link>
        </div>
        <div className="developer-strip">
          {catalogue.developers.slice(0, 6).map((developer) => (
            <Link key={developer.id} href={`/developers/${encodeURIComponent(developer.id)}`}>
              {developer.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="section closing-section">
        <p className="eyebrow">LET’S TALK ABOUT YOUR NEXT MOVE</p>
        <h2>
          Find a place
          <br />
          <em>to call your own.</em>
        </h2>
        <Link className="button" href="/contact">
          Talk to us →
        </Link>
      </section>
    </>
  );
}
