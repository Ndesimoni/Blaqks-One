import Link from 'next/link';

export function PlatformOpportunities() {
  return (
    <>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OPPORTUNITIES, WITH CONTEXT</p>
            <h2>Property deals, in perspective.</h2>
          </div>
          <Link href="/deals">Explore property deals →</Link>
        </div>
        <div className="platform-deal-intro">
          <Link href="/deals#distress">
            <h3>Distress deals ↗</h3>
            <p>A clear view of the listing, the circumstances and the figures behind it.</p>
          </Link>
          <Link href="/deals#discount">
            <h3>Discount deals ↗</h3>
            <p>Understand asking prices and the evidence behind any advertised reduction.</p>
          </Link>
        </div>
      </section>
      <section className="section platform-deal-section" id="distress">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A CLOSER LOOK AT THE COLLECTION</p>
            <h2>Distress deals.</h2>
          </div>
          <Link href="/deals">View distress deals →</Link>
        </div>
        <div className="notice">
          <h3>No verified distress deals published yet.</h3>
          <p>
            Listings will appear here when their deal details and reference prices are available.
          </p>
          <Link href="/properties">Explore the current property collection →</Link>
        </div>
      </section>
    </>
  );
}
