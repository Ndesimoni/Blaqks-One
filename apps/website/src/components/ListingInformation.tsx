import Link from 'next/link';
import type { Agent, Company, Developer, Listing } from '../lib/types';
import { furnishings, optionLabel } from '../lib/options';
import { count } from './ui';

export function ListingInformation({
  listing,
  agent,
  company,
  developer,
}: {
  listing: Listing;
  agent?: Agent;
  company?: Company;
  developer?: Developer;
}) {
  return (
    <section className="detail-section" id="details">
      <h2>Listing information</h2>
      <dl className="key-values">
        {listing.advertisingPermit && (
          <div>
            <dt>Advertising permit</dt>
            <dd>
              {listing.advertisingPermit}
              <small>Provided by the listing company</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Public reference</dt>
          <dd>{listing.reference}</dd>
        </div>
        <div>
          <dt>Furnishing</dt>
          <dd>
            {listing.furnishing ? optionLabel(furnishings, listing.furnishing) : 'Not specified'}
          </dd>
        </div>
        <div>
          <dt>Parking</dt>
          <dd>{listing.parking > 0 ? count(listing.parking, 'space') : 'No parking'}</dd>
        </div>
        {listing.purpose === 'holiday' && (
          <>
            <div>
              <dt>Maximum guests</dt>
              <dd>{listing.guests}</dd>
            </div>
            <div>
              <dt>Minimum stay</dt>
              <dd>{count(listing.minimumStay, 'night')}</dd>
            </div>
          </>
        )}
        {developer && (
          <div>
            <dt>Developer</dt>
            <dd>
              <Link href={`/developers/${encodeURIComponent(developer.id)}`}>{developer.name}</Link>
              {listing.developerIllustrative && (
                <small>Illustrative association · Not an actual developer listing</small>
              )}
            </dd>
          </div>
        )}
        {company && (
          <div>
            <dt>Company</dt>
            <dd>
              <Link href={`/companies/${encodeURIComponent(company.id)}`}>{company.name}</Link>
            </dd>
          </div>
        )}
        {agent && (
          <div>
            <dt>Representative</dt>
            <dd>
              <Link href={`/agents/${encodeURIComponent(agent.id)}`}>{agent.name}</Link>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
