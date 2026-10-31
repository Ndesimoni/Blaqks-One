import Link from 'next/link';
import type { Catalogue, Site } from '../lib/types';

export function HomeHero({ site, catalogue }: { site: Site; catalogue: Catalogue }) {
  const company = catalogue.companies.find((item) => item.id === site.company);
  const heading =
    site.kind === 'platform' ? (
      <>
        Find a place.
        <br />
        <em>Make it yours.</em>
      </>
    ) : site.theme === '2' ? (
      <>
        Your next move
        <br />
        <em>starts here.</em>
      </>
    ) : site.theme === '3' ? (
      <>
        Considered homes.
        <br />
        <em>Extraordinary living.</em>
      </>
    ) : site.theme === '4' ? (
      <>
        Exceptional homes
        <br />
        <em>across the UAE.</em>
      </>
    ) : (
      <>
        Some places
        <br />
        <em>feel like home.</em>
      </>
    );
  return (
    <section className={`hero hero-theme-${site.theme}`}>
      <img
        src="/property/villa-exterior.jpg"
        alt="Illustrative villa with a garden and pool"
        width="1800"
        height="1200"
        fetchPriority="high"
      />
      <div className="hero-content">
        <p className="eyebrow">
          {site.kind === 'platform' ? 'BLAQKS ONE · PROPERTY & PEOPLE' : company?.name || site.name}
        </p>
        <h1>{site.content?.heroTitle || heading}</h1>
        <p>
          {site.content?.heroSubtitle ||
            site.content?.tagline ||
            (site.kind === 'platform'
              ? 'Discover properties and the people who know them. A considered way to find your next home in the UAE.'
              : company?.note || 'A personal perspective on property.')}
        </p>
        <Link className="button hero-button" href="/properties">
          Explore the collection →
        </Link>
      </div>
    </section>
  );
}
