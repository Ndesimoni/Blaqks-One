import { useEffect } from 'react';
import { useStartRequest } from '../server/products/useStartRequest.js';

/** Sign-up's team step asks for the invitation form with `?start=invite`; `open` shows it. */
export function useInviteRequest(enabled, open) {
  const asked = useStartRequest('invite', enabled);
  useEffect(() => {
    if (asked) open();
    // `open` is a new function each render; only a new request opens the form.
  }, [asked]);
}
