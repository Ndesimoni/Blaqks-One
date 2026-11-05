import Link from 'next/link';
import { samplePrices } from '@/lib/plans';
import { PlanCards } from './PlanCards';
import { SecHead } from './SecHead';

/** The plans on the home page, with a link to the full comparison. */
export function PricingSection() {
  return (
    <section className="sec flush" aria-labelledby="price-title">
      <div className="wrap">
        <SecHead
          tag="Pricing"
          id="price-title"
          title="Start free. Grow when you are ready."
          sample={samplePrices ? 'Sample prices' : undefined}
        />
        <PlanCards />
        <p className="alt" style={{ marginTop: 26 }}>
          <Link className="link" href="/pricing">
            Compare every feature
          </Link>
        </p>
      </div>
    </section>
  );
}
