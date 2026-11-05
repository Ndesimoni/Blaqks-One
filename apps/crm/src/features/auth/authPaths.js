/** The account pages, each at its own address (owner, 2026-11-05: industry-standard pages). */
export const SIGN_IN = '/sign-in';
export const SIGN_UP_STEPS = ['/sign-up', '/sign-up/verify', '/sign-up/company'];

/** Pages a person is never sent back to after signing in. */
const accountPage = (path) =>
  path === SIGN_IN ||
  path === '/sign-out' ||
  path === '/activate-invitation' ||
  path.startsWith('/sign-up');

export const isSignUpPath = (path) => SIGN_UP_STEPS.includes(path);

/** The sign-in address for a signed-out visit, remembering the page they asked for. */
export function signInPath(pathname, search = '') {
  const next = pathname + search;
  if (pathname === '/' || accountPage(pathname)) return SIGN_IN;
  return `${SIGN_IN}?${new URLSearchParams({ next })}`;
}

/** Where to go after signing in: the remembered page when it is one of ours, else home. */
export function afterSignIn(search) {
  const next = new URLSearchParams(search).get('next') || '';
  const path = next.split('?')[0];
  if (!next.startsWith('/') || next.startsWith('//') || accountPage(path)) return '/';
  return next;
}
