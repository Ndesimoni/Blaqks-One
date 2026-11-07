import Link from 'next/link';
import type { Site } from '../../lib/types';

export function CompanyServices({ site, full = false }: { site: Site; full?: boolean }) {
  return (
    <section className="a-section a-services">
      <div className="a-section-head">
        <h2>
          See what we offer
          <br />
          and how it works
        </h2>
        <p>From the first conversation to your next chapter, a clear path through property.</p>
      </div>
      <div className="a-service-grid">
        <div className="a-service-list">
          {site.content?.services ? (
            <p className="a-published-copy">{site.content.services}</p>
          ) : (
            <>
              <details open>
                <summary>
                  <span>01</span>Property selection <span>−</span>
                </summary>
                <p>
                  Explore homes by the way you want to live. Refine the location, space and budget,
                  then speak to the person who represents the property.
                </p>
                <Link href="/properties">Explore the collection ↗</Link>
              </details>
              <details>
                <summary>
                  <span>02</span>Let’s talk about your next move <span>＋</span>
                </summary>
                <p>
                  Tell us what matters to you. Our team can discuss your property requirements and
                  the next steps.
                </p>
                <Link href="/enquiry">Make an enquiry ↗</Link>
              </details>
              <details>
                <summary>
                  <span>03</span>Get to know the neighbourhood <span>＋</span>
                </summary>
                <p>
                  Discover the communities behind our collection and ask your advisor for a local
                  perspective.
                </p>
                <Link href="/areas">Explore neighbourhoods ↗</Link>
              </details>
            </>
          )}
          {!full && (
            <Link className="a-text-link" href="/services">
              All our services ↗
            </Link>
          )}
        </div>
        <figure>
          <img
            src="/company/residence.jpg"
            alt="Illustrative contemporary architecture"
            width={1000}
            height={850}
            loading="lazy"
          />
          <figcaption>Architecture inspiration · illustrative photography</figcaption>
        </figure>
      </div>
    </section>
  );
}
export function CompanyStory({ site }: { site: Site }) {
  return (
    <section className="a-section a-story">
      <figure>
        <img
          src="/company/interior.jpg"
          alt="Illustrative light-filled living space"
          width={1200}
          height={1000}
          loading="lazy"
        />
        <figcaption>Spaces that inspire · illustrative photography</figcaption>
      </figure>
      <div>
        <p className="a-kicker">A PERSONAL PERSPECTIVE</p>
        <h2>
          A home is a place.
          <br />
          Belonging is a feeling.
        </h2>
        <p>
          {site.content?.about ||
            'We believe finding a property should feel considered, clear and personal. Start with the spaces that speak to you, then connect with the people who know them.'}
        </p>
        <Link className="a-text-link" href="/about">
          Discover our approach ↗
        </Link>
      </div>
    </section>
  );
}
export function CompanyClosing() {
  return (
    <section className="a-closing a-section">
      <p className="a-kicker">YOUR NEXT CHAPTER</p>
      <div>
        <h2>
          Let’s find
          <br />
          your place.
        </h2>
        <Link className="a-action" href="/contact">
          Start a conversation <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
