import Link from 'next/link';
import type { Listing } from '../../lib/types';
import { money } from '../ui';

export function CompanyMobileContact({ listing }: { listing: Listing }) {
  return (
    <div className="a-mobile-property-contact" aria-label="Property enquiry">
      <div>
        <small>
          {listing.purpose === 'buy'
            ? 'ASKING PRICE'
            : listing.purpose === 'rent'
              ? 'ANNUAL RENT'
              : 'NIGHTLY RATE'}
        </small>
        <strong>{money(listing)}</strong>
      </div>
      <Link className="a-action" href={`/enquiry?listing=${encodeURIComponent(listing.id)}`}>
        Enquire ↗
      </Link>
    </div>
  );
}
