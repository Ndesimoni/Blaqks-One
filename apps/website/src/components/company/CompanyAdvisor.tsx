import Link from 'next/link';
import type { Agent, PageData } from '../../lib/types';
import { ContactLinks, initials } from '../ui';
import { SocialLinkList } from '../SocialLinkList';
import { CompanyGrid, CompanyTeam } from './CompanyCards';

export function CompanyAdvisor({ site, entity, catalogue }: PageData) {
  const a = entity as Agent;
  const listings = catalogue.listings.filter((p) => p.agent === a.id);
  const others = { ...catalogue, agents: catalogue.agents.filter((p) => p.id !== a.id) };
  return (
    <div className="a-container a-inner">
      <p className="breadcrumb">
        <Link href="/agents">← Meet the team</Link> / {a.name}
      </p>
      <section className="a-advisor-hero">
        <div className="a-portrait">
          <span>{initials(a.name)}</span>
        </div>
        <div>
          <p className="a-kicker">YOUR PROPERTY PARTNER</p>
          <h1>{a.name}</h1>
          <p>
            {a.specialty} · {site.name}
          </p>
          <SocialLinkList links={a.social} owner={a.name} sample={site.sample} />
        </div>
      </section>
      <div className="a-advisor-layout">
        <section>
          <p className="a-kicker">A PERSONAL APPROACH</p>
          <h2>Start with a conversation.</h2>
          <p>
            Explore the properties represented by {a.name.split(' ')[0]} and ask about the spaces,
            locations and details that matter to your next move.
          </p>
          <dl className="a-advisor-facts">
            <div>
              <dt>Specialism</dt>
              <dd>{a.specialty}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{site.name}</dd>
            </div>
            <div>
              <dt>Published properties</dt>
              <dd>{a.publicListingCount ?? listings.length}</dd>
            </div>
          </dl>
        </section>
        <aside className="enquiry-panel">
          <p className="a-kicker">MAKE A CONNECTION</p>
          <h2>Speak with {a.name.split(' ')[0]}.</h2>
          <p>A property, a location or your next step. Let’s talk.</p>
          <Link className="button" href={`/enquiry?agent=${encodeURIComponent(a.id)}`}>
            Send an enquiry ↗
          </Link>
          <ContactLinks agent={a} />
        </aside>
      </div>
      <section className="a-section">
        <div className="a-section-head">
          <div>
            <p className="a-kicker">THE PROPERTY COLLECTION</p>
            <h2>Represented by {a.name.split(' ')[0]}.</h2>
          </div>
          <Link href={`/properties?agent=${encodeURIComponent(a.id)}`}>View all properties ↗</Link>
        </div>
        {listings.length ? (
          <CompanyGrid listings={listings} catalogue={catalogue} />
        ) : (
          <p className="notice">No properties are currently published for this advisor.</p>
        )}
      </section>
      {!!others.agents.length && (
        <section className="a-section">
          <div className="a-section-head">
            <div>
              <p className="a-kicker">MORE PEOPLE TO CONNECT WITH</p>
              <h2>Meet more of our team.</h2>
            </div>
            <Link href="/agents">All advisors ↗</Link>
          </div>
          <CompanyTeam catalogue={others} />
        </section>
      )}
    </div>
  );
}
