import { lazy, useEffect } from 'react';

/**
 * The signed-in CRM loads on its own (owner, 2026-11-05: sign-in and sign-up open quickly).
 * The account pages need only the session and their forms; every CRM screen downloads after
 * as soon as the first page shows, while the person reads or types, so signing in opens fast.
 */
const load = () => import('./ServerDirectory.jsx');

export const ServerDirectory = lazy(() =>
  load().then((module) => ({ default: module.ServerDirectory })),
);

/** Starts downloading the CRM as soon as the first page is on screen, alongside the form. */
export function useWorkspacePreload() {
  useEffect(() => {
    load();
  }, []);
}
