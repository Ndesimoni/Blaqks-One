import { links } from '@/lib/site';
import { Arrow } from './Arrow';
import { Reveal } from './Reveal';
import { ListingArt, OffersArt, ShieldArt } from './RowArt';
import { SecHead } from './SecHead';

type Row = {
  tag: string;
  title: string;
  text: string;
  ticks: string[];
  action: React.ReactNode;
  art: React.ReactNode;
};

const rows: Row[] = [
  {
    tag: 'Private by design',
    title: 'Your clients stay yours',
    text: 'Every company works in its own private workspace. Agents see the clients assigned to them, and every change is on record.',
    ticks: [
      'A private workspace for each company',
      'Roles for who may message, publish or approve',
      'Team activity in Dubai time',
    ],
    action: (
      <a className="btn btn-dark" href="/help">
        Learn more <Arrow />
      </a>
    ),
    art: <ShieldArt />,
  },
  {
    tag: 'Websites',
    title: 'Publish a listing with one switch',
    text: 'Your company website and the Blaqks One site update from your listings. Enquiries come back to the CRM and reach the listing’s agent.',
    ticks: [
      'A company site with your team and listings',
      'Publish or withdraw in one click',
      'Each agent controls their public profile',
    ],
    action: (
      <a className="btn btn-dark" href={links.propertySite} target="_blank" rel="noopener">
        See the Blaqks One property site ↗
      </a>
    ),
    art: <ListingArt />,
  },
  {
    tag: 'Marketplace',
    title: 'Agree the split before details are shared',
    text: 'Post what your client is looking for. Approved brokerages offer properties, and contacts stay hidden until both sides agree.',
    ticks: [
      'Client requests with budget, area and dates',
      'Offers from approved brokerages only',
      'Co-broking agreements with a full record',
    ],
    action: (
      <a className="btn btn-dark" href="/products/marketplace">
        Explore the marketplace <Arrow />
      </a>
    ),
    art: <OffersArt />,
  },
];

/** Three alternating rows: privacy, publishing and the marketplace. */
export function FeatureRows() {
  return (
    <section className="sec flush" aria-labelledby="rows-title">
      <div className="wrap">
        <SecHead
          tag="Powerful features"
          id="rows-title"
          title="See the whole business at a glance"
          sub="Clear access for every member, and a full record for the owner."
        />
        <div className="rows">
          {rows.map((row, i) => (
            <div key={row.title} className={'row' + (i % 2 ? ' flip' : '')}>
              <Reveal className="row-text">
                <span className="tag">{row.tag}</span>
                <h3>{row.title}</h3>
                <p>{row.text}</p>
                <ul className="ticks">
                  {row.ticks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {row.action}
              </Reveal>
              <Reveal delay={0.1}>{row.art}</Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
