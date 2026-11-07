import Link from 'next/link';
import type { PageData } from '../../lib/types';
import { initials, ContactLinks } from '../ui';
import { Arrow } from '../motion/Arrow';

export function HomeverseLifestyle({ catalogue }: Pick<PageData, 'catalogue'>) {
  const waterfront = catalogue.areas.find((a) => /marina|beach|waterfront/i.test(a.name));
  const choices = [
    {
      title: 'Waterfront living',
      text: 'A little closer to the water.',
      image: '/company/terrace.jpg',
      href: waterfront ? `/properties?area=${encodeURIComponent(waterfront.id)}` : '/areas',
    },
    {
      title: 'Room for family',
      text: 'Space for your next chapter.',
      image: '/company/garden-house.jpg',
      href: '/properties?type=Villa',
    },
    {
      title: 'City apartments',
      text: 'Find your place in the city.',
      image: '/company/interior.jpg',
      href: '/properties?type=Apartment',
    },
    {
      title: 'Investment properties',
      text: 'Explore the collection for sale.',
      image: '/company/residence.jpg',
      href: '/properties?purpose=buy',
    },
  ];
  return (
    <section className="v-lifestyle a-container v-section">
      <div className="v-section-title">
        <p className="v-eyebrow">A HOME FOR YOUR LIFESTYLE</p>
        <h2>Different places. Your kind of living.</h2>
        <p>Start with what matters most to you.</p>
      </div>
      <div className="v-lifestyle-grid">
        {choices.map((c) => (
          <Link key={c.title} href={c.href}>
            <img src={c.image} alt="" width={600} height={450} loading="lazy" />
            <div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <span aria-hidden="true">↗</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function HomeverseAdvisors({ site, catalogue }: Pick<PageData, 'site' | 'catalogue'>) {
  const advisors = catalogue.agents.filter((a) => a.company === site.company).slice(0, 3);
  if (!advisors.length) return null;
  return (
    <section className="v-advisors a-container v-section">
      <div className="v-advisor-heading">
        <div>
          <p className="v-eyebrow">THE PEOPLE BEHIND YOUR NEXT MOVE</p>
          <h2>Local knowledge. Personal service.</h2>
        </div>
        <Link href="/agents">
          Meet the team <Arrow />
        </Link>
      </div>
      <div className="v-advisor-grid">
        {advisors.map((a) => (
          <article key={a.id}>
            <Link
              className="v-advisor-avatar"
              href={`/agents/${encodeURIComponent(a.id)}`}
              aria-label={`Meet ${a.name}`}
            >
              <span>{initials(a.name)}</span>
            </Link>
            <div>
              <p className="v-eyebrow">PROPERTY ADVISOR</p>
              <h3>
                <Link href={`/agents/${encodeURIComponent(a.id)}`}>{a.name}</Link>
              </h3>
              <p>{a.specialty}</p>
              <ContactLinks agent={a} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function HomeverseTrust({ site, catalogue }: Pick<PageData, 'site' | 'catalogue'>) {
  const company = catalogue.companies.find((c) => c.id === site.company);
  return (
    <div className="v-trust a-container">
      <div>
        <strong>{site.name}</strong>
        <span>{company?.area || 'United Arab Emirates'}</span>
      </div>
      <div>
        <strong>Know your property</strong>
        <span>Clear prices and listing references</span>
      </div>
      <div>
        <strong>Know your advisor</strong>
        <span>Named contacts on every listing</span>
      </div>
      <Link href="/about">Get to know us →</Link>
    </div>
  );
}
