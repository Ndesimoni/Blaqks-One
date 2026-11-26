import Link from 'next/link';

/** The Blaqks One wordmark with its gold dot, linking home. */
export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Blaqks One home">
      Blaqks One
      <i aria-hidden="true" />
    </Link>
  );
}
