'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CompanyNavigation({ links }: { links: string[][] }) {
  const path = usePathname();
  return (
    <nav className="a-nav" aria-label="Main navigation">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href || path.startsWith(href + '/') ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
