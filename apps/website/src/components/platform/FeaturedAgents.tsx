import Link from 'next/link';
import type { Catalogue } from '../../lib/types';
import { AgentPortrait } from './AgentPortrait';

export function FeaturedAgents({ catalogue }: { catalogue: Catalogue }) {
  if (!catalogue.agents.length) return null;
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE PEOPLE BEHIND YOUR NEXT MOVE</p>
          <h2>Featured agents.</h2>
        </div>
        <Link href="/agents">Find your property partner →</Link>
      </div>
      <div className="platform-featured-agents">
        {catalogue.agents.slice(0, 4).map((agent) => (
          <Link
            className="person-card"
            key={agent.id}
            href={`/agents/${encodeURIComponent(agent.id)}`}
          >
            <AgentPortrait agent={agent} />
            <div>
              <h3>{agent.name}</h3>
              <p>{agent.specialty}</p>
              <small>{catalogue.companies.find((c) => c.id === agent.company)?.name}</small>
              <span>View profile ↗</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
