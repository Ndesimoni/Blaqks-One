import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SIGN_UP_STEPS } from '../auth/authPaths.js';

const [DETAILS, , COMPANY, TEAM] = SIGN_UP_STEPS;

/**
 * Keeps sign-up's address and step together, so the browser's Back works on every step.
 * Before the account exists the step leads: each step forward is a new page, and Back from the
 * code returns to the details. Once it exists the address leads: the code page is replaced by
 * the company, saving the company opens the team as a new page, Back from the team returns to
 * the company, and Back from the company leaves sign-up for the new workspace's start page.
 */
export function useSignupAddress(flow, signedIn) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const last = useRef(null);
  const created = flow.step >= 3 || (signedIn && pathname === TEAM);
  const step = !created ? flow.step : pathname === TEAM && (flow.finished || signedIn) ? 4 : 3;
  useEffect(() => {
    const before = last.current;
    last.current = { step, finished: flow.finished };
    if (!created) {
      const wanted = SIGN_UP_STEPS[step - 1];
      if (pathname === wanted) return;
      if (before?.step === step && step === 2 && pathname === DETAILS) flow.back();
      else navigate(wanted, { replace: !before || step <= before.step });
      return;
    }
    if (before && flow.finished > before.finished) navigate(TEAM);
    else if (before && before.step < 3) navigate(COMPANY, { replace: true });
    else if (pathname !== COMPANY && pathname !== TEAM) navigate('/start', { replace: true });
    // `flow` is a new object each render; the step, the save count and the address matter.
  }, [step, flow.finished, pathname, navigate]);
  return step;
}
