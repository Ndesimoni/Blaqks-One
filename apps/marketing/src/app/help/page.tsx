import type { Metadata } from 'next';
import { HelpCentre } from '@/components/HelpCentre';
import { SecHead } from '@/components/SecHead';

export const metadata: Metadata = {
  title: 'Help centre',
  description: 'Answers about getting started, your team, the marketplace, websites and billing.',
};

/** The help centre: search and topics over every answer. */
export default function HelpPage() {
  return (
    <section className="sec page-top" aria-labelledby="help-title">
      <div className="wrap">
        <SecHead level={1} tag="Help centre" id="help-title" title="How can we help?" />
        <HelpCentre />
      </div>
    </section>
  );
}
