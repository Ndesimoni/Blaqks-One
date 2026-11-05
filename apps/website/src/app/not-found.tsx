import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section page-heading">
      <p className="eyebrow">PAGE UNAVAILABLE</p>
      <h1>This page isn’t available.</h1>
      <p>The page may have moved, or this website or listing is no longer available.</p>
      <Link className="button" href="/">
        Go to homepage
      </Link>
    </section>
  );
}
