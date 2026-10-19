import { meetsPasswordPolicy, passwordRules } from '../../lib/passwordPolicy.js';

export const BOT_TOKEN = 'local-development';
export const EMIRATES = [
  'abu-dhabi',
  'dubai',
  'sharjah',
  'ajman',
  'umm-al-quwain',
  'ras-al-khaimah',
  'fujairah',
];

export const initialDetails = Object.freeze({
  name: '',
  email: '',
  phone: '',
  password: '',
  consent: false,
});

export const normalizePhone = (value) => String(value || '').replace(/\s+/g, '');

export const startPayload = (details, status, language) => ({
  name: details.name.trim(),
  email: details.email.trim().toLowerCase(),
  phone: normalizePhone(details.phone),
  password: details.password,
  termsVersion: status.terms.version,
  privacyVersion: status.privacy.version,
  language,
  botToken: BOT_TOKEN,
});

export const companyPayload = (company, setup) => ({
  version: company.version,
  displayName: setup.displayName.trim(),
  emirate: setup.emirate,
});

export function detailsError(values) {
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const phone = normalizePhone(values.phone);
  if (!name || [...name].length > 100) return ['name', 'signupErrors.invalidName'];
  if (!email || !email.includes('@') || !/^[\x00-\x7F]+$/.test(email))
    return ['email', 'signupErrors.invalidEmail'];
  if (!/^\+\d{7,15}$/.test(phone)) return ['phone', 'signupErrors.invalidPhone'];
  if (!meetsPasswordPolicy(values.password, { email }))
    return ['password', 'signupErrors.weakPassword'];
  if (!values.consent) return ['consent', 'signupErrors.consentRequired'];
  return null;
}

export const translatedPasswordRules = (password, email) =>
  passwordRules(password, { email }).map(({ id, met }) => ({ id, met }));

export const validCode = (code) => /^\d{6}$/.test(code);

/** Isolates left-to-right identifiers inside translated right-to-left sentences. */
export const bidiIsolate = (value) => `\u2068${String(value || '')}\u2069`;

export function setupError(values) {
  const name = values.displayName.trim();
  if (!name || [...name].length > 120) return ['displayName', 'signupErrors.invalidCompany'];
  if (!EMIRATES.includes(values.emirate)) return ['emirate', 'signupErrors.invalidCompany'];
  return null;
}

/** Steps 1 and 3 hold unsaved input; step 2 and a finished setup do not. */
export function isDirty({ step, finished, details, setup }) {
  if (finished) return false;
  if (step === 1) return Object.values(details).some(Boolean);
  return step === 3 && (Boolean(setup.displayName) || Boolean(setup.emirate));
}

const ERROR_KEYS = {
  invalid_name: 'invalidName',
  invalid_email: 'invalidEmail',
  invalid_phone: 'invalidPhone',
  weak_password: 'weakPassword',
  consent_required: 'consentRequired',
  consent_outdated: 'consentOutdated',
  invalid_language: 'invalidLanguage',
  bot_check_failed: 'botCheckFailed',
  bot_check_unavailable: 'botCheckUnavailable',
  rate_limited: 'rateLimited',
  signup_busy: 'signupBusy',
  invalid_code: 'invalidCode',
  code_locked: 'codeLocked',
  resend_too_soon: 'resendTooSoon',
  account_exists: 'accountExists',
  invalid_company: 'invalidCompany',
  version_conflict: 'versionConflict',
};

export const errorKey = (failure) => {
  const code = failure?.details?.code;
  return ERROR_KEYS[code] ? `signupErrors.${ERROR_KEYS[code]}` : 'signupErrors.unavailable';
};
