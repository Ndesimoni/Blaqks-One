import React from 'react';
import './boot-splash.css';

/**
 * The one quiet screen while the CRM opens (owner, 2026-11-05: no stacked loading messages):
 * the wordmark on the page colour, gently pulsing; screen readers hear "Loading".
 */
export function BootSplash() {
  return (
    <main className="boot-splash" aria-busy="true">
      <span className="boot-mark" aria-hidden="true">
        Blaqks One
        <i />
      </span>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </main>
  );
}
