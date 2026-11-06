import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { HomeverseIcon } from './HomeverseIcon';
import { CompanySampleForm } from '../company/CompanySampleForm';
import { EnquiryForm } from '../EnquiryForm';
import { ContactLinks } from '../ui';
const benefits = [
  [
    'home',
    'A place for every chapter',
    'Explore homes for sale, annual rentals and holiday stays.',
  ],
  ['handshake', 'A personal approach', 'Speak directly with the advisor behind each property.'],
  ['support', 'Guidance at every step', 'From your first shortlist to arranging a viewing.'],
  ['shield', 'Clarity from the start', 'Property details and asking prices, clearly presented.'],
];
export function HomeverseBenefits() {
  return (
    <section className="v-benefits">
      <div className="a-container">
        <div className="v-section-title">
          <p className="v-eyebrow">OUR SERVICES</p>
          <h2>A better way to find your home.</h2>
        </div>
        <div className="v-benefit-grid">
          {benefits.map(([icon, title, text]) => (
            <article key={icon}>
              <HomeverseIcon name={icon} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export function HomeverseAbout({ site }: Pick<PageData, 'site'>) {
  return (
    <section className="v-about a-container v-section">
      <figure>
        <img
          src="/company/interior.jpg"
          alt="Illustrative bright living room with considered contemporary furnishings"
          width={1100}
          height={800}
          loading="lazy"
        />
        <figcaption>
          Spaces to feel at home in. <span>Illustrative photography</span>
        </figcaption>
      </figure>
      <div>
        <p className="v-eyebrow">ABOUT US</p>
        <h2>
          We help you find
          <br />
          your dream home.
        </h2>
        <p>
          {site.content?.about ||
            `At ${site.name}, your next move begins with what matters to you. Explore our collection and connect with a property advisor for a more personal search.`}
        </p>
        <ul className="v-checklist">
          <li>Homes for the way you want to live</li>
          <li>Clear asking prices and property information</li>
          <li>A dedicated point of contact for your enquiry</li>
        </ul>
        <Link className="v-button" href="/about">
          Learn more about us <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
export function HomeverseContact({ site, catalogue }: PageData) {
  const agent = catalogue.agents[0];
  return (
    <section className="v-contact">
      <div className="a-container v-contact-layout">
        <div>
          <p className="v-eyebrow">GET IN TOUCH</p>
          <h2>
            Ready to find your
            <br />
            dream property?
          </h2>
          <p>Tell us what you’re looking for. Let’s make your next move a little simpler.</p>
          {agent && (
            <>
              <p className="v-contact-advisor">Start a conversation with {agent.name}</p>
              <ContactLinks agent={agent} />
            </>
          )}
          <Link className="v-contact-link" href="/contact">
            Contact our team →
          </Link>
        </div>
        <div className="v-contact-card">
          {site.sample ? (
            <CompanySampleForm compact />
          ) : (
            <EnquiryForm compact companyId={site.company || undefined} />
          )}
        </div>
      </div>
    </section>
  );
}
