'use client';

export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <section className="section page-heading">
      <p className="eyebrow">TEMPORARILY UNAVAILABLE</p>
      <h1>We couldn’t load this page.</h1>
      <p>Please try again shortly. Your request has not been sent.</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </section>
  );
}
