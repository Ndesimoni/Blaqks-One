import { useCallback, useState } from 'react';
import { finishSetup } from './finishSetup.js';
import {
  detailsError,
  errorKey,
  initialDetails,
  isDirty,
  startPayload,
  validCode,
} from './signupModel.js';
import { clearSignupResume, loadSignupResume, saveSignupResume } from './signupResume.js';
import { useSignupBot } from './useSignupBot.js';
import { useSignupCountdown } from './useSignupCountdown.js';

export function useSignUpFlow({ api, status, language, onVerified }) {
  const [resume] = useState(() => loadSignupResume());
  const [step, setStep] = useState(resume ? 2 : 1);
  const [details, setDetails] = useState({ ...initialDetails });
  const [request, setRequest] = useState(resume ? { ...resume, sends: 1 } : null);
  const [code, setCode] = useState('');
  const [company, setCompany] = useState(null);
  const [createdUser, setCreatedUser] = useState(null);
  const [setup, setSetup] = useState({ displayName: '', emirate: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useSignupCountdown(0);
  const bot = useSignupBot(status);
  const setDetail = useCallback((field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setError((current) => (current?.field === field ? null : current));
  }, []);
  const start = async () => {
    const invalid = detailsError(details);
    if (invalid) return setError({ field: invalid[0], key: invalid[1] });
    setBusy('start');
    setError(null);
    try {
      const value = await api.signupStart(startPayload(details, status, language, bot.token));
      const next = { ...value, sends: 1 };
      setRequest(next);
      saveSignupResume(next);
      setSeconds(value.resendAfterSeconds);
      setCode('');
      bot.reset();
      setStep(2);
    } catch (failure) {
      bot.reset();
      setError({ key: errorKey(failure) });
    } finally {
      setBusy('');
    }
  };
  const install = useCallback(
    ({ user, company: profile }) => {
      clearSignupResume();
      setCompany(profile);
      setCreatedUser(user);
      setSetup({ displayName: user.name, emirate: '' });
      onVerified(user);
      setStep(3);
    },
    [onVerified],
  );
  const verify = async () => {
    if (!validCode(code)) return setError({ field: 'code', key: 'signupErrors.codeRequired' });
    setBusy('verify');
    setError(null);
    try {
      install(await api.signupVerify(request.requestId, code));
    } catch (failure) {
      if (failure.status === 0) {
        try {
          const user = await api.session();
          return install({ user, company: await api.company(user.workspaceId) });
        } catch {
          setError({ key: 'signupErrors.unavailable' });
        }
      } else setError({ field: 'code', key: errorKey(failure) });
    } finally {
      setBusy('');
    }
  };
  const resend = async () => {
    setBusy('resend');
    setError(null);
    try {
      const value = await api.signupResend(request.requestId, bot.token);
      setRequest((current) => {
        const next = { ...current, ...value, sends: current.sends + 1 };
        saveSignupResume(next);
        return next;
      });
      setSeconds(value.resendAfterSeconds);
      setCode('');
      bot.reset();
    } catch (failure) {
      bot.reset();
      setError({ key: errorKey(failure) });
    } finally {
      setBusy('');
    }
  };
  const saveSetup = () =>
    finishSetup({
      api,
      user: createdUser,
      company,
      setup,
      setCompany,
      setFinished,
      setBusy,
      setError,
    });
  return {
    step,
    details,
    request,
    code,
    company,
    setup,
    error,
    busy,
    botToken: bot.token,
    setBotToken: bot.setToken,
    botReset: bot.resetKey,
    seconds,
    finished,
    dirty: isDirty({ step, finished, details, setup }),
    setDetail,
    start,
    setCode,
    setError,
    verify,
    resend,
    back: () => setStep((value) => Math.max(1, value - 1)),
    differentEmail: () => {
      clearSignupResume();
      setError(null);
      setCode('');
      setStep(1);
    },
    setSetup: (field, value) => {
      setSetup((current) => ({ ...current, [field]: value }));
      setError((current) => (current?.field === field ? null : current));
    },
    saveSetup,
  };
}
