import type { IconName } from '@/lib/products';
import { Icon } from './Icon';
import { Reveal } from './Reveal';
import { SecHead } from './SecHead';

const roles: [IconName, string, string][] = [
  [
    'home',
    'Brokerage owners',
    'See every lead, deal and commission across the team, with clear access for each member.',
  ],
  [
    'crm',
    'Agents',
    'Your clients, viewings and follow-ups in one place, and WhatsApp messages on the client record.',
  ],
  [
    'logo',
    'Off-plan sales teams',
    'Payment plans, deposits and developer projects, without another spreadsheet.',
  ],
  [
    'spark',
    'Holiday-home managers',
    'Nightly rates and homes organised, and published to your website.',
  ],
];

/** Who the workspace is for: the four roles in a brokerage. */
export function Who() {
  return (
    <section className="sec flush" aria-labelledby="who-title">
      <div className="wrap">
        <SecHead tag="Who it’s for" id="who-title" title="Made for every role in a brokerage" />
        <div className="who">
          {roles.map(([icon, title, text], i) => (
            <Reveal key={title} className="who-card" delay={i * 0.06}>
              <span className="mark-s">
                <Icon name={icon} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
