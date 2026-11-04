import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ServerSignIn } from '../server/ServerSignIn.jsx';
import { SIGN_IN, signInPath } from './authPaths.js';

/**
 * Signed out, every page opens the sign-in page at its own address, which remembers the page
 * asked for (`?next=`) so signing in returns there.
 */
export function SignInGate(props) {
  const { pathname, search } = useLocation();
  if (pathname !== SIGN_IN) return <Navigate replace to={signInPath(pathname, search)} />;
  return <ServerSignIn {...props} />;
}
