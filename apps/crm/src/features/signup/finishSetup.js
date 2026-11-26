import { companyPayload, errorKey, setupError } from './signupModel.js';

// Finishing setup is the last write in the sign-up flow, so it lives outside the
// hook to keep the flow state machine small and readable.
export async function finishSetup({
  api,
  user,
  company,
  setup,
  setCompany,
  setFinished,
  setBusy,
  setError,
}) {
  const invalid = setupError(setup);
  if (invalid) return setError({ field: invalid[0], key: invalid[1] });
  setBusy('setup');
  setError(null);
  try {
    const saved = await api.updateCompany(user.workspaceId, companyPayload(company, setup));
    setCompany(saved);
    setFinished(true);
  } catch (failure) {
    setError({ key: errorKey(failure) });
  } finally {
    setBusy('');
  }
}
