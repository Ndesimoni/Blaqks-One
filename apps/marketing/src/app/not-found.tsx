import Link from 'next/link';

/** A page that does not exist. */
export default function NotFound() {
  return (
    <section className="sec page-top">
      <div className="wrap sec-head">
        <span className="tag">Not found</span>
        <h1>We could not find that page</h1>
        <p>It may have moved. Start again from the home page.</p>
        <Link className="btn btn-gold" href="/">
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
