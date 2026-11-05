const KEY = 'kws-crm-signup-resume-v1';

function validResume(value, now = Date.now()) {
  return (
    value?.accountType === 'brokerage' &&
    typeof value.requestId === 'string' &&
    Boolean(value.requestId) &&
    typeof value.maskedEmail === 'string' &&
    Boolean(value.maskedEmail) &&
    typeof value.expiresAt === 'string' &&
    Date.parse(value.expiresAt) > now
  );
}

export function loadSignupResume(storage = globalThis.sessionStorage, now) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    if (validResume(value, now)) return value;
    storage.removeItem(KEY);
  } catch {
    // Storage may be unavailable or contain an older invalid value.
  }
  return null;
}

export function saveSignupResume(request, storage = globalThis.sessionStorage) {
  const value = {
    requestId: request.requestId,
    maskedEmail: request.maskedEmail,
    accountType: 'brokerage',
    expiresAt: request.expiresAt,
  };
  try {
    if (validResume(value)) storage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Sign-up still works when tab storage is blocked.
  }
}

export function clearSignupResume(storage = globalThis.sessionStorage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // Sign-up still works when tab storage is blocked.
  }
}
