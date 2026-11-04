import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SIGN_UP_STEPS } from '../auth/authPaths.js';

/**
 * Keeps sign-up's address on its step: a step forward adds a page to the history, so the
 * browser's Back on the code page returns to the details; going back or opening a step that
 * is not ready (the code page without a code request) replaces the address instead.
 */
export function useSignupAddress(flow) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const shown = useRef(null);
  useEffect(() => {
    const wanted = SIGN_UP_STEPS[flow.step - 1];
    const before = shown.current ?? flow.step;
    shown.current = flow.step;
    if (pathname === wanted) return;
    if (before === flow.step && flow.step === 2 && pathname === SIGN_UP_STEPS[0]) flow.back();
    else navigate(wanted, { replace: flow.step <= before });
    // `flow` is a new object each render; the step and the address are what matter.
  }, [flow.step, pathname, navigate]);
}
