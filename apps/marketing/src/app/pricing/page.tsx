import type { Metadata } from 'next';
import { Faq } from '@/components/Faq';
import { PlanCards } from '@/components/PlanCards';
import { Reveal } from '@/components/Reveal';
import { SecHead } from '@/components/SecHead';
import { help } from '@/lib/help';
import { featureRows, plans, samplePrices } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free with three seats. Upgrade when your team grows.',
};

const cell = (value: string | boolean) => (value === true ? '✓' : value === false ? '–' : value);

/** Pricing: the plans, every feature by plan, and pricing questions. */
export default function PricingPage() {
  return (
    <>
      <section className="sec page-top" aria-labelledby="pricing-title">
        <div className="wrap">
          <SecHead
            level={1}
            tag="Pricing"
            id="pricing-title"
            title="Simple plans for every brokerage"
            sub="Start free with three seats. Upgrade when your team grows."
            sample={samplePrices ? 'Sample prices' : undefined}
          />
          <PlanCards />
          <Reveal className="table-wrap">
            <table className="plan-table">
              <caption className="sr">Features by plan</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} scope="col">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureRows.map(([feature, ...values]) => (
                  <tr key={feature}>
                    <th scope="row">{feature}</th>
                    {values.map((value, i) => (
                      <td
                        key={i}
                        className={value === true ? 'yes' : undefined}
                        aria-label={
                          typeof value === 'boolean'
                            ? value
                              ? 'Included'
                              : 'Not included'
                            : undefined
                        }
                      >
                        {cell(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>
      <section className="sec flush" aria-labelledby="billing-title">
        <div className="wrap">
          <SecHead tag="Questions" id="billing-title" title="Pricing questions" />
          <Faq
            items={help.filter(
              (item) => item.topic === 'Billing' || item.topic === 'Getting started',
            )}
          />
        </div>
      </section>
    </>
  );
}
