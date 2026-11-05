import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routePath } from '../../config/routes.js';
import { SIGN_UP_STEPS } from '../auth/authPaths.js';

const [DETAILS, , COMPANY] = SIGN_UP_STEPS;

/**
 * Keeps sign-up's address and step together, so the browser's Back works on every step.
 * Before the account exists each step forward is a new page, and Back from the code returns to
 * the details. Once it exists the code page is replaced by the company; saving the company
 * opens the start page with its tour, and Back from the company leaves sign-up for the start
 * page, because the code is used up.
 */
export function useSignupAddress(flow) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const last = useRef(null);
  const start = routePath('Start');
  useEffect(() => {
    const before = last.current;
    last.current = { step: flow.step, finished: flow.finished };
    if (flow.step < 3) {
      const wanted = SIGN_UP_STEPS[flow.step - 1];
      if (pathname === wanted) return;
      if (before?.step === 2 && flow.step === 2 && pathname === DETAILS) flow.back();
      else navigate(wanted, { replace: !before || flow.step <= before.step });
      return;
    }
    if (flow.finished && !before?.finished) navigate(`${start}?start=tour`, { replace: true });
    else if (before && before.step < 3) navigate(COMPANY, { replace: true });
    else if (pathname !== COMPANY) navigate(start, { replace: true });
    // `flow` is a new object each render; the step, the finish and the address matter.
  }, [flow.step, flow.finished, pathname, navigate, start]);
}
