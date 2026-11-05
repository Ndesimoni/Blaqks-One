import Link from 'next/link';
import { help } from '@/lib/help';
import { Faq } from './Faq';
import { SecHead } from './SecHead';

/** The first five questions, with a link to the help centre. */
export function Questions() {
  return (
    <section className="sec flush" aria-labelledby="faq-title">
      <div className="wrap">
        <SecHead tag="Questions" id="faq-title" title="Before you start" />
        <Faq items={help.slice(0, 5)} />
        <p className="alt" style={{ marginTop: 26 }}>
          More answers in the{' '}
          <Link className="link" href="/help">
            Help centre
          </Link>
        </p>
      </div>
    </section>
  );
}
