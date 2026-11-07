import Link from 'next/link';
import type { Catalogue, Listing } from '../../lib/types';
import { HomeverseSave } from './HomeverseSave';
import { HomeverseIcon } from './HomeverseIcon';
import { bedrooms, count, money } from '../ui';
export function HomeverseCards({
  listings,
  catalogue,
}: {
  listings: Listing[];
  catalogue: Catalogue;
}) {
  return (
    <div className="v-property-grid">
      {listings.map((p) => (
        <article className="v-property-card" key={p.id}>
          <div className="v-card-media">
            <Link
              className="v-card-image"
              href={`/properties/${encodeURIComponent(p.id)}`}
              aria-label={`View ${p.title}, ${money(p)}`}
            >
              <img src={p.image} alt={p.title} width={650} height={500} loading="lazy" />
              <span className={`v-status ${p.purpose === 'buy' ? 'v-status-sale' : ''}`}>
                {p.purpose === 'buy'
                  ? 'For sale'
                  : p.purpose === 'rent'
                    ? 'For rent'
                    : 'Holiday home'}
              </span>
              <span className="v-card-price">{money(p)}</span>
              <span className="v-photo-count">
                <HomeverseIcon name="photos" size={13} />
                {count(p.photos.length || 1, 'photo')}
              </span>
            </Link>
            <HomeverseSave id={p.id} title={p.title} company={p.company} />
          </div>
          <div className="v-card-copy">
            <h3>
              <Link href={`/properties/${encodeURIComponent(p.id)}`}>{p.title}</Link>
            </h3>
            <p>
              {catalogue.areas.find((a) => a.id === p.area)?.name || p.emirate} · {p.type}
            </p>
            <div className="v-card-facts">
              <span>{bedrooms(p)}</span>
              <span>{count(p.bathrooms, 'bath')}</span>
              <span>{p.size.toLocaleString('en-AE')} sq ft</span>
            </div>
            <Link className="v-card-details" href={`/properties/${encodeURIComponent(p.id)}`}>
              View property <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
