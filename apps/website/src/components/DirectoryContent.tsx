import Link from 'next/link';
import type { Catalogue } from '../lib/types';
import { AgentCard, CompanyCard } from './Cards';

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
        {catalogue.developers.map((developer) => (
          <article className="developer-card" key={developer.id}>
            <p className="eyebrow">UAE DEVELOPER</p>
            <h2>
              <Link href={`/developers/${encodeURIComponent(developer.id)}`}>{developer.name}</Link>
            </h2>
            <p className="muted">{developer.emirate.replaceAll('-', ' ')}</p>
            {developer.publicListingCount !== undefined && (
              <p className="muted">
                {developer.publicListingCount} public listings on this website
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
