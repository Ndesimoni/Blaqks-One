import { ctaLabel, plans } from '@/lib/plans';
import { links } from '@/lib/site';
import { Arrow } from './Arrow';
import { Reveal } from './Reveal';

/** The three plans; Start free and the trial open sign-up, Talk to us opens Contact. */
export function PlanCards() {
  return (
    <div className="prices">
      {plans.map((plan, i) => (
        <Reveal key={plan.name} className={'price' + (plan.best ? ' best' : '')} delay={i * 0.08}>
          {plan.best && <span className="chip g best-tag">Most popular</span>}
          <b style={{ fontSize: 18 }}>{plan.name}</b>
          <div className="amt">
            {plan.price} <small>per month</small>
          </div>
          <p>{plan.text}</p>
          <a
            className={'btn ' + (plan.best ? 'btn-gold' : 'btn-dark')}
            href={plan.cta === 'talk' ? '/contact' : links.signUp}
          >
            {ctaLabel[plan.cta]} <Arrow />
          </a>
          <ul className="ticks">
            {plan.ticks.map((tick) => (
              <li key={tick}>{tick}</li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  );
}
