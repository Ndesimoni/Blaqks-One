'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function CompanyFilterPanel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 961px)');
    const sync = () => {
      if (panel.current) panel.current.open = wide.matches;
    };
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);
  return (
    <details className="a-filter-sidebar" ref={panel}>
      <summary>
        Refine your search <span aria-hidden="true">＋</span>
      </summary>
      <div className="a-filter-body">{children}</div>
    </details>
  );
}
