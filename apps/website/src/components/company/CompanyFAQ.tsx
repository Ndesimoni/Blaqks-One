import Link from 'next/link';

const questions = [
  [
    'How do I arrange a viewing?',
    'Open a property and contact its listing advisor. They can confirm availability and discuss a suitable viewing time. Sending an enquiry does not automatically confirm a booking.',
  ],
  [
    'Can I refine my search further?',
    'Yes. Choose More options to carry your selections into the property search. There you can refine bedrooms, bathrooms, furnishing, amenities, size and completion status.',
  ],
  [
    'What do the advertised prices include?',
    'Sale prices are total asking prices, rental prices are annual and holiday rates are per night. Fees, payment terms and current availability should be confirmed with the representative.',
  ],
  [
    'Can I speak to someone about my own property?',
    'Yes. Use the company contact page to describe your property and requirements. The team can discuss the next steps with you.',
  ],
];

export function CompanyFAQ() {
  return (
    <section className="a-section a-home-faq" aria-labelledby="company-faq-title">
      <div className="a-section-head">
        <h2 id="company-faq-title">
          A little clarity.
          <br />
          Before your next move.
        </h2>
        <p>The practical details, simply explained.</p>
      </div>
      <div className="a-home-faq-grid">
        <div>
          {questions.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden="true">＋</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <aside>
          <p className="a-kicker">LET’S MAKE IT PERSONAL</p>
          <h3>
            Have something
            <br />
            else in mind?
          </h3>
          <p>Start with a conversation about what matters to you.</p>
          <Link className="a-text-link" href="/contact">
            Ask our team ↗
          </Link>
        </aside>
      </div>
    </section>
  );
}
