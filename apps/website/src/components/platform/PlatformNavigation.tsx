'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, type ReactNode } from 'react';

export function PlatformNavigation() {
  const pathname = usePathname();
  return (
    <nav className="platform-nav" aria-label="Main navigation">
      {[
        ['/', 'Home'],
        ['/properties', 'Properties'],
        ['/deals', 'Deals'],
        ['/agents', 'Agents'],
        ['/companies', 'Companies'],
        ['/about', 'About'],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ProfessionalMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={menu}
      className="platform-professionals"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a') && menu.current) menu.current.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menu.current) {
          menu.current.open = false;
          menu.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary>
        For Agents & Companies <span aria-hidden="true">⌄</span>
      </summary>
      {children}
    </details>
  );
}
