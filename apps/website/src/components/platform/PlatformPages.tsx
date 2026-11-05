import Link from 'next/link';
import { Heading } from '../ui';
import { crmEntry } from '../../lib/crm-entry';

export function PlatformDeals() {
  return (
    <section className="section page-top">
      <Heading
        eyebrow="OPPORTUNITIES WITH CONTEXT"
        title="Property deals, in perspective."
        text="Clear information and considered opportunities. No verified deal listings are currently available."
      />
      <div className="platform-deal-intro">
        <section id="distress">
          <h2>Distress deals</h2>
          <p>No verified distress deals published yet.</p>
        </section>
        <section id="discount">
          <h2>Discount deals</h2>
          <p>No verified discounted listings published yet.</p>
        </section>
      </div>
      <p className="notice">
        A deal needs more than a label. Ask the listing professional about the asking price,
        reference evidence, availability and the circumstances behind any reduction.
      </p>
      <Link className="button" href="/properties">
        Explore all properties →
      </Link>
    </section>
  );
}

export function PlatformProfessionals() {
  const crm = crmEntry();
  return (
    <section className="section page-top">
      <Heading
        eyebrow="FOR AGENTS & COMPANIES"
        title="Your next chapter. One connected workspace."
        text="Property discovery on the outside. Professional relationships at the heart of your business."
      />
      <div className="values-grid">
        <div>
          <h2>Your properties.</h2>
          <p>Bring your property portfolio into focus.</p>
        </div>
        <div>
          <h2>Your people.</h2>
          <p>A workspace for your company and its professional relationships.</p>
        </div>
        <div>
          <h2>Your next move.</h2>
          <p>Connect your public presence with your business.</p>
        </div>
      </div>
      {crm ? (
        <div className="advanced-actions">
          <a className="button" href={crm}>
            CRM sign in ↗
          </a>
          <a href={`${crm.replace(/\/$/, '')}/#/sign-up`}>Create a company account →</a>
        </div>
      ) : (
        <p className="notice">For workspace access, contact your company administrator.</p>
      )}
      <Link className="text-link" href="/companies">
        Explore the companies behind the collection →
      </Link>
    </section>
  );
}
