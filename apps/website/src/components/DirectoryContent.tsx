import Link from 'next/link';
import type { Catalogue } from '../lib/types';
import { AgentCard, CompanyCard } from './Cards';
import { count } from './ui';
import { developersByListings } from '../lib/developer-order';

export function DirectoryContent({ page, catalogue }: { page: string; catalogue: Catalogue }) {
  if (page === 'companies')
    return (
      <div className="people-grid">
        {catalogue.companies.map((company) => (
          <CompanyCard key={company.id} company={company} catalogue={catalogue} />
        ))}
      </div>
    );
  if (page === 'agents')
    return (
      <div className="people-grid">
        {catalogue.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} catalogue={catalogue} />
        ))}
      </div>
    );
  if (page === 'developers')
    return (
      <div className="developer-grid">
        {developersByListings(catalogue.developers).map((developer) => (
          <article className="developer-card" key={developer.id}>
            <p className="eyebrow">{developer.emirate.replaceAll('-', ' ')}</p>
            <h2>
              <Link href={`/developers/${encodeURIComponent(developer.id)}`}>{developer.name}</Link>
            </h2>
            {!!developer.publicListingCount && (
              <p className="muted">
                {count(developer.publicListingCount, 'public listing')} on this website
              </p>
            )}
            <Link href={`/developers/${encodeURIComponent(developer.id)}`}>
              View profile & properties →
            </Link>
          </article>
        ))}
      </div>
    );
  return (
    <div className="area-grid">
      {catalogue.areas.map((area) => (
        <Link className="area-card" key={area.id} href={`/areas/${encodeURIComponent(area.id)}`}>
          <img src={area.image} alt={area.name} width="600" height="450" loading="lazy" />
          <div>
            <h2>{area.name}</h2>
            <p>{area.city}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
