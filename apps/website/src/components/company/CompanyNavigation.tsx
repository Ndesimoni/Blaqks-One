'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CompanyNavigation({
  links,
  className = 'a-nav',
}: {
  links: string[][];
  className?: string;
}) {
  const path = usePathname();
  return (
    <nav className={className} aria-label="Main navigation">
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
