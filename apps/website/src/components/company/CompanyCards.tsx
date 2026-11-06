import Link from 'next/link';
import type { Catalogue, Listing } from '../../lib/types';
import { money, initials } from '../ui';

export function CompanyGrid({
  listings,
  catalogue,
}: {
  listings: Listing[];
  catalogue: Catalogue;
}) {
  return (
    <div className="a-grid">
      {listings.map((p) => {
        const area = catalogue.areas.find((a) => a.id === p.area);
        return (
          <article className="a-card" key={p.id}>
            <Link
              className="a-card-image"
              href={`/properties/${encodeURIComponent(p.id)}`}
              aria-label={`View ${p.title}`}
            >
              <img src={p.image} alt={p.title} width={800} height={650} loading="lazy" />
            </Link>
            <div className="a-card-heading">
              <h3>
                <Link href={`/properties/${encodeURIComponent(p.id)}`}>{p.title}</Link>
              </h3>
              <span>{money(p)}</span>
            </div>
            <p className="a-card-location">
              {area?.name || p.emirate} · {p.type}
            </p>
            <div className="a-card-facts">
              <span>
                {p.bedrooms === null
                  ? 'Commercial'
                  : p.bedrooms === 0
                    ? 'Studio'
                    : `${p.bedrooms} beds`}
              </span>
              <span>{p.bathrooms} baths</span>
              <span>{p.size.toLocaleString()} sq ft</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
export function CompanyTeam({ catalogue, limit = 4 }: { catalogue: Catalogue; limit?: number }) {
  return (
    <div className="a-team-grid">
      {catalogue.agents.slice(0, limit).map((a) => (
        <article className="a-person" key={a.id}>
          <Link
            className="a-portrait"
            href={`/agents/${encodeURIComponent(a.id)}`}
            aria-label={`Meet ${a.name}`}
          >
            <span>{initials(a.name)}</span>
          </Link>
          <div className="a-person-copy">
            <p className="a-kicker">PROPERTY ADVISOR</p>
            <h3>{a.name}</h3>
            <p>{a.specialty}</p>
            <Link href={`/agents/${encodeURIComponent(a.id)}`}>Meet {a.name.split(' ')[0]} ↗</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
