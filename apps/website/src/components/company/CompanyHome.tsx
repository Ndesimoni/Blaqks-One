import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { CompanyGrid, CompanyTeam } from './CompanyCards';
import { CompanyFAQ } from './CompanyFAQ';
import { CompanyHero } from './CompanyHero';
import { CompanyClosing, CompanyServices, CompanyStory } from './CompanySections';
import { Arrow } from '../motion/Arrow';

export function CompanyHome({ site, catalogue }: PageData) {
  return (
    <>
      <CompanyHero site={site} catalogue={catalogue} />
      <div className="a-container a-home-content">
        <section className="a-section" aria-labelledby="find-home">
          <div className="a-section-head">
            <h2 id="find-home">
              We help you find the
              <br />
              home that will be yours.
            </h2>
            <p>
              Find the space, setting and details that matter to you. Start with a location and make
              the search your own.
            </p>
          </div>
        </section>
        <section className="a-section a-new-properties">
          <div className="a-section-head">
            <h2>New properties</h2>
            <Link className="a-text-link" href="/properties">
              All properties <Arrow up />
            </Link>
          </div>
          {catalogue.listings.length ? (
            <CompanyGrid catalogue={catalogue} listings={catalogue.listings.slice(0, 6)} />
          ) : (
            <p className="notice">
              Our public property collection is being prepared.{' '}
              <Link href="/contact">
                Talk to our team <Arrow />
              </Link>
            </p>
          )}
        </section>
        <CompanyServices site={site} />
        <CompanyStory site={site} />
        {!!catalogue.agents.length && (
          <section className="a-section">
            <div className="a-section-head">
              <div>
                <p className="a-kicker">THE PEOPLE BEHIND YOUR NEXT MOVE</p>
                <h2>Good places. Good people.</h2>
              </div>
              <Link className="a-text-link" href="/agents">
                Meet the team <Arrow up />
              </Link>
            </div>
            <CompanyTeam catalogue={catalogue} />
          </section>
        )}
        <CompanyFAQ />
        <CompanyClosing />
      </div>
    </>
  );
}
