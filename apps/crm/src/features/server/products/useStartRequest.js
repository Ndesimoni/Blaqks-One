import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A Create menu request in the address (`?start=email`): taken once, removed from the address
 * (so Back and reload never open it again) and returned as a count that rises per request.
 */
export function useStartRequest(name, enabled = true) {
  const location = useLocation();
  const go = useNavigate();
  const [count, setCount] = useState(0);
  const asked = enabled && new URLSearchParams(location.search).get('start') === name;
  useEffect(() => {
    if (!asked) return;
    const next = new URLSearchParams(location.search);
    next.delete('start');
    setCount((value) => value + 1);
    go({ pathname: location.pathname, search: next.size ? `?${next}` : '' }, { replace: true });
  }, [asked, go, location.pathname, location.search]);
  return count;
}
