import { Bento } from '@/components/Bento';
import { Closing } from '@/components/Closing';
import { Compare } from '@/components/Compare';
import { FeatureRows } from '@/components/FeatureRows';
import { Gallery } from '@/components/Gallery';
import { Hero } from '@/components/Hero';
import { Logos } from '@/components/Logos';
import { PricingSection } from '@/components/PricingSection';
import { Questions } from '@/components/Questions';
import { Trust } from '@/components/Trust';
import { Who } from '@/components/Who';

/** Home: the approved website design, top to bottom. */
export default function Home() {
  return (
    <>
      <Hero />
      <Logos />
      <Who />
      <Bento />
      <Compare />
      <FeatureRows />
      <Trust />
      <PricingSection />
      <Gallery />
      <Questions />
      <Closing />
    </>
  );
}
