import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { CompanyTeam } from './CompanyCards';
import { CompanyClosing } from './CompanySections';

export function CompanyAbout({ site, catalogue }: PageData) {
  return (
    <div className="a-container">
      <section className="a-page-intro">
        <p className="a-kicker">MEET {site.name.toUpperCase()}</p>
        <h1>
          Property is personal.
          <br />
          So are we.
        </h1>
        <p>{site.content?.tagline || 'Good places begin with a better understanding of you.'}</p>
      </section>
      <img
        className="a-about-image"
        src="/company/interior.jpg"
        alt="Illustrative contemporary living space"
        width={1200}
        height={800}
      />
      <section className="a-section a-section-head">
        <h2>
          A clear perspective.
          <br />A personal approach.
        </h2>
        <div>
          <p>
            {site.content?.about ||
              'Finding a property is about more than a floor plan. It’s about the way you want to live, the space you need and the future you have in mind.'}
          </p>
          <p>
            Explore clearly presented properties, meet the people who represent them and take the
            next step with a conversation.
          </p>
          <Link className="a-text-link" href="/services">
            How we can help ↗
          </Link>
        </div>
      </section>
      <section className="a-values">
        <article>
          <span>01 /</span>
          <h3>Start with you.</h3>
          <p>
            Your requirements shape the search. Location, lifestyle, space and budget come first.
          </p>
        </article>
        <article>
          <span>02 /</span>
          <h3>Keep it clear.</h3>
          <p>
            Named representatives. Published property details. A clear way to ask the questions that
            matter.
          </p>
        </article>
        <article>
          <span>03 /</span>
          <h3>Make a connection.</h3>
          <p>Talk directly to the people behind a property and discuss the next steps together.</p>
        </article>
      </section>
      {!!catalogue.agents.length && (
        <section className="a-section">
          <div className="a-section-head">
            <h2>People, before property.</h2>
            <Link href="/agents">Meet the team ↗</Link>
          </div>
          <CompanyTeam catalogue={catalogue} />
        </section>
      )}
      <CompanyClosing />
    </div>
  );
}
