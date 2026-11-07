import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { HomeverseLifestyle, HomeverseAdvisors, HomeverseTrust } from './HomeverseDiscovery';
import { HomeverseSearch } from './HomeverseSearch';
import { HomeverseCards } from './HomeverseCards';
import { HomeverseAbout, HomeverseBenefits, HomeverseContact } from './HomeverseSections';
import { Arrow } from '../motion/Arrow';
export function HomeverseHome(data: PageData) {
  const { site, catalogue } = data;
  const heroImage = site.sample ? '/company/hero-dusk.jpg' : catalogue.listings[0]?.image;
  return (
    <>
      <section className="v-hero">
        {heroImage && (
          <img
            className="v-hero-image"
            src={heroImage}
            alt="Contemporary home with generous glazing and warm interior light"
            width={2560}
            height={1440}
            fetchPriority="high"
          />
        )}
        <div className="a-container v-hero-content">
          <p className="v-eyebrow">FIND YOUR DREAM HOME</p>
          <h1>
            {site.content?.heroTitle || (
              <>
                Find a perfect
                <br />
                <span>home</span> to live in.
              </>
            )}
          </h1>
          <p>
            {site.content?.heroSubtitle ||
              'A place that fits your life. Discover exceptional properties and take the next step with confidence.'}
          </p>
          <div className="v-actions">
            <Link className="v-button" href="/properties">
              Explore properties <Arrow />
            </Link>
            <Link className="v-button-outline" href="/contact">
              Contact us <Arrow />
            </Link>
          </div>
        </div>
      </section>
      <div className="v-search-wrap a-container">
        <HomeverseSearch catalogue={catalogue} />
      </div>
      <section className="v-featured a-container v-section">
        <div className="v-section-title">
          <p className="v-eyebrow">FEATURED PROPERTIES</p>
          <h2>Explore our premium properties.</h2>
          <p>Discover your next home, your own space, your new beginning.</p>
        </div>
        {catalogue.listings.length ? (
          <HomeverseCards catalogue={catalogue} listings={catalogue.listings.slice(0, 4)} />
        ) : (
          <p className="notice">
            Our collection is being prepared.{' '}
            <Link href="/contact">
              Speak to the team <Arrow />
            </Link>
          </p>
        )}
        <div className="v-view-all">
          <Link className="v-button" href="/properties">
            View all properties <Arrow />
          </Link>
        </div>
      </section>
      <HomeverseTrust {...data} />
      <HomeverseLifestyle catalogue={catalogue} />
      <HomeverseBenefits />
      <HomeverseAbout site={site} />
      <HomeverseAdvisors {...data} />
      <HomeverseContact {...data} />
    </>
  );
}
