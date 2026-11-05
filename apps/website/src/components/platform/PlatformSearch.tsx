'use client';

import { useRef, useState } from 'react';

export function PlatformSearch() {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return (
    <div className="platform-search">
      <button
        type="button"
        aria-label={open ? 'Close property search' : 'Open property search'}
        aria-expanded={open}
        aria-controls="platform-header-search"
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => field.current?.focus());
        }}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </button>
      <form
        id="platform-header-search"
        className="platform-header-search"
        action="/properties"
        method="get"
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.currentTarget.parentElement?.querySelector('button')?.focus();
          }
        }}
      >
        <label htmlFor="platform-query">Find your next property</label>
        <div>
          <span aria-hidden="true">⌕</span>
          <input
            ref={field}
            id="platform-query"
            name="q"
            type="search"
            placeholder="Property or neighbourhood…"
          />
          <button className="button" type="submit">
            Search properties →
          </button>
        </div>
      </form>
    </div>
  );
}
