import Link from 'next/link';
import { CompanySearch } from './CompanySearch';
import type { PageData } from '../../lib/types';

export function CompanyHero({ site, catalogue }: Pick<PageData, 'site' | 'catalogue'>) {
  const image = catalogue.listings[0]?.image;
  return (
    <section className={`a-hero ${site.sample ? 'a-reference-hero' : 'a-published-hero'}`}>
      <div className="a-hero-intro a-container">
        <div>
          <h1>
            {site.content?.heroTitle || (
              <>
                Find a place you
                <br />
                will call home
              </>
            )}
          </h1>
          <Link className="a-action" href="/contact">
            Book a call
          </Link>
        </div>
        <div className="a-hero-note">
          <p>
            {site.content?.heroSubtitle ||
              'With us you will find not just accommodation, but a place where your new life begins, full of cosiness and possibilities.'}
          </p>
        </div>
      </div>
      {site.sample ? (
        <div
          className="a-reference-house"
          role="img"
          aria-label="Illustrative two-storey contemporary house and sports car from the supplied design reference"
        />
      ) : (
        image && (
          <img
            className="a-hero-image"
            src={image}
            alt={catalogue.listings[0].title}
            width={1800}
            height={950}
            fetchPriority="high"
          />
        )
      )}
      <div className="a-hero-search a-container" role="search" aria-label="Find a property">
        <CompanySearch catalogue={catalogue} />
      </div>
    </section>
  );
}
