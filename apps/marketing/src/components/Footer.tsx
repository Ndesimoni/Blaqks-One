import Link from 'next/link';
import { products } from '@/lib/products';
import { links, siteLine } from '@/lib/site';
import { Wordmark } from './Wordmark';

type Item = [label: string, href: string, external?: boolean];

const columns: [string, Item[]][] = [
  ['Products', products.map((p): Item => [p.name, `/products/${p.key}`])],
  [
    'Company',
    [
      ['About us', '/'],
      ['Contact', '/contact'],
      ['Pricing', '/pricing'],
    ],
  ],
  [
    'Resources',
    [
      ['Help centre', '/help'],
      ['Sign in', links.signIn, true],
      ['Find a property ↗', links.propertySite, true],
    ],
  ],
  [
    'Legal',
    [
      ['Terms of Service', '/help'],
      ['Privacy Notice', '/help'],
    ],
  ],
];

/** The footer: every page, sign-in and the public property site (opens in a new tab). */
export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div>
          <Wordmark />
          <p>{siteLine}</p>
        </div>
        {columns.map(([title, items]) => (
          <div key={title}>
            <strong>{title}</strong>
            <ul>
              {items.map(([label, href, external]) => (
                <li key={label}>
                  {external ? (
                    <a
                      href={href}
                      {...(label.endsWith('↗') ? { target: '_blank', rel: 'noopener' } : {})}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link href={href}>{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="foot-base">
        <div className="wrap">
          <span>© 2026 Blaqks One. All rights reserved.</span>
          <span>Dubai, United Arab Emirates</span>
        </div>
      </div>
    </footer>
  );
}
