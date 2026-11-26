import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A client slider's Convert to deal (`?start=deal&client=CL-…`): taken once, removed from the
 * address (so Back and reload never open it again), then `open(clientId)`.
 */
export function useDealStartRequest(open, enabled = true) {
  const location = useLocation();
  const go = useNavigate();
  const latest = useRef(open);
  useLayoutEffect(() => {
    latest.current = open;
  });
  const params = new URLSearchParams(location.search);
  const asked = enabled && params.get('start') === 'deal';
  const clientId = params.get('client') || '';
  useEffect(() => {
    if (!asked) return;
    const next = new URLSearchParams(location.search);
    next.delete('start');
    next.delete('client');
    latest.current(clientId);
    go({ pathname: location.pathname, search: next.size ? `?${next}` : '' }, { replace: true });
  }, [asked, clientId, go, location.pathname, location.search]);
}
