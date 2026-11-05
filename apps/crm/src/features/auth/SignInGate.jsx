import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ServerSignIn } from '../server/ServerSignIn.jsx';
import { SIGN_IN, signInPath } from './authPaths.js';

/**
 * Back from the sign-in page onto a CRM page that needs signing in: step back once more
 * instead of bouncing to sign-in again, so Back reaches the page before the CRM. If there is
 * nothing further back, the sign-in page returns.
 */
function StepBack({ fallback }) {
  const go = useNavigate();
  const stepped = useRef(false);
  useEffect(() => {
    if (!stepped.current) {
      stepped.current = true;
      window.history.back();
    }
    const stuck = setTimeout(() => go(fallback, { replace: true }), 700);
    return () => clearTimeout(stuck);
  }, [fallback, go]);
  return null;
}

/**
 * Signed out, every page opens the sign-in page at its own address, which remembers the page
 * asked for (`?next=`) so signing in returns there. Once the sign-in page has shown, the
 * browser's Back and Forward pass over pages that need signing in.
 */
export function SignInGate(props) {
  const { pathname, search } = useLocation();
  const type = useNavigationType();
  const shown = useRef(false);
  if (pathname === SIGN_IN) {
    shown.current = true;
    return <ServerSignIn {...props} />;
  }
  const target = signInPath(pathname, search);
  if (shown.current && type === 'POP')
    return <StepBack key={pathname + search} fallback={target} />;
  return <Navigate replace to={target} />;
}
