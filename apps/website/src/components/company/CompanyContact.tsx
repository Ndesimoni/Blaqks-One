import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { EnquiryForm } from '../EnquiryForm';
import { ContactLinks } from '../ui';
import { SocialLinkList } from '../SocialLinkList';
import { CompanySampleForm } from './CompanySampleForm';

export function CompanyContact({ site, catalogue }: PageData) {
  const company = catalogue.companies.find((c) => c.id === site.company);
  return (
    <div className="a-container a-inner">
      <section className="a-page-intro">
        <p className="a-kicker">LET’S MAKE A CONNECTION</p>
        <h1>
          Your next move.
          <br />
          Let’s talk about it.
        </h1>
        <p>
          {site.content?.contactText ||
            'A question, a property or a new possibility. We’re here to start the conversation.'}
        </p>
      </section>
      <div className="a-contact-layout">
        <div>
          <img
            className="a-contact-image"
            src="/company/interior.jpg"
            alt="Illustrative interior inspiration, not a company office"
            width={1200}
            height={900}
          />
          <p className="a-image-caption">INTERIOR INSPIRATION · NOT A COMPANY OFFICE</p>
          <h2>{site.name}</h2>
          <p>{company?.area || 'United Arab Emirates'}</p>
          <p className="muted">Office address and opening hours have not been supplied.</p>
          <SocialLinkList links={site.social} owner={site.name} sample={site.sample} />
          <div className="a-direct-contacts">
            <p className="a-kicker">PREFER A PERSONAL INTRODUCTION?</p>
            {catalogue.agents.map((a) => (
              <div key={a.id}>
                <Link href={`/agents/${encodeURIComponent(a.id)}`}>{a.name} ↗</Link>
                <ContactLinks agent={a} />
              </div>
            ))}
          </div>
        </div>
        <div className="a-contact-form">
          <p className="a-kicker">TELL US A LITTLE ABOUT YOU</p>
          {site.sample ? (
            <CompanySampleForm />
          ) : (
            <EnquiryForm companyId={site.company || undefined} />
          )}
        </div>
      </div>
      <section className="a-section a-faq">
        <p className="a-kicker">A FEW HELPFUL ANSWERS</p>
        <h2>Before we talk.</h2>
        <details>
          <summary>How do I arrange a viewing?</summary>
          <p>
            Open a property and send an enquiry to its listing advisor. Your advisor can discuss
            availability and arrange the next steps.
          </p>
        </details>
        <details>
          <summary>Can I discuss a specific property?</summary>
          <p>
            Yes. Start your enquiry on the property page so its reference and listing representative
            stay with the conversation.
          </p>
        </details>
        <details>
          <summary>Are the asking prices annual or monthly?</summary>
          <p>
            Rental asking prices are annual. Holiday rates are per night. Sale prices are the full
            asking price. Always confirm payment terms with your advisor.
          </p>
        </details>
      </section>
    </div>
  );
}
