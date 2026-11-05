import { Reveal } from './Reveal';
import { SecHead } from './SecHead';

const before = [
  'Leads arrive on personal WhatsApp numbers and get lost',
  'Listings live in spreadsheets and get typed again for the website',
  'Nobody is sure which agent is handling which client',
  'Co-broking deals are agreed on trust, with nothing written down',
  'Commissions are worked out by hand at the end of the month',
];
const after = [
  'Every message lands in a shared inbox and becomes a lead',
  'Listings publish to your website with one switch',
  'Every client has an owner, a next step and a full history',
  'Co-broking agreements are recorded step by step',
  'Deals, commissions and payments are approved in the CRM',
];

/** Before and after: the usual patchwork beside one workspace. */
export function Compare() {
  return (
    <section className="sec flush" aria-labelledby="compare-title">
      <div className="wrap">
        <SecHead
          tag="Before and after"
          id="compare-title"
          title="Replace the patchwork with one workspace"
          sub="Most brokerages run on WhatsApp, spreadsheets and a separate website. Here is what changes."
        />
        <div className="compare">
          <Reveal className="compare-col">
            <h3>Without Blaqks One</h3>
            <ul>
              {before.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="compare-col with" delay={0.08}>
            <h3>With Blaqks One</h3>
            <ul>
              {after.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
