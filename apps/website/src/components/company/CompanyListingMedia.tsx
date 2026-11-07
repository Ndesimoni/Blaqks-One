import Link from 'next/link';
import type { Listing } from '../../lib/types';

export function CompanyListingMedia({ listing }: { listing: Listing }) {
  const href = '/enquiry?listing=' + encodeURIComponent(listing.id);
  return (
    <section className="detail-section a-listing-media" id="media">
      <p className="a-kicker">EXPLORE THE SPACE</p>
      <h2>Floor plans & tours.</h2>
      <div>
        <article>
          <h3>Floor plans</h3>
          {listing.floorPlans.length ? (
            <ul>
              {listing.floorPlans.map((plan, i) => (
                <li key={plan}>
                  <a href={plan} target="_blank" rel="noopener noreferrer">
                    View floor plan {i + 1} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p>A floor plan has not been supplied for this property.</p>
              <Link href={href}>Request a floor plan ↗</Link>
            </>
          )}
        </article>
        <article>
          <h3>Video & virtual tours</h3>
          <p>Contact the representative about available videos or virtual viewing options.</p>
          <Link href={href}>Ask about tours ↗</Link>
        </article>
      </div>
    </section>
  );
}
