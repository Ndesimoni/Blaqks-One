'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function MobileMenu({ links }: { links: string[][] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  return (
    <details className="mobile-menu" ref={menu}>
      <summary>Menu</summary>
      <nav aria-label="Mobile navigation">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
