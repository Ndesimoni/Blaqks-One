import { EMIRATES } from '../../signup/signupModel.js';

/**
 * Settings → Company (design queue item 15): the editable draft, its checks and the saved
 * body. The server repeats every check; office details are optional and saved trimmed.
 */
const FIELDS = ['displayName', 'tradeLicence', 'emirate', 'officePhone', 'officeAddress'];

export const companyDraft = (company) =>
  Object.fromEntries(FIELDS.map((field) => [field, company?.[field] || '']));

export const draftChanged = (draft, company) => {
  const saved = companyDraft(company);
  return FIELDS.some((field) => draft[field].trim() !== saved[field]);
};

const oneLine = (text, limit) => [...text].length <= limit && !/[\u0000-\u001f]/.test(text);

/** `+` then 7 to 15 digits once spaces, dashes and brackets are taken out, as the server. */
export const phoneDigits = (text) => text.replace(/[\s\-()]/g, '');
const phoneValid = (text) => /^\+\d{7,15}$/.test(phoneDigits(text));

/** `{ field: catalogue key }` for each field that needs fixing; empty when the draft is fine. */
export function companyErrors(draft) {
  const errors = {};
  const name = draft.displayName.trim();
  if (!name || !oneLine(name, 120)) errors.displayName = 'company.invalidName';
  if (!EMIRATES.includes(draft.emirate)) errors.emirate = 'company.invalidEmirate';
  if (!oneLine(draft.tradeLicence.trim(), 40)) errors.tradeLicence = 'company.invalidLicence';
  const phone = draft.officePhone.trim();
  if (phone && !phoneValid(phone)) errors.officePhone = 'company.invalidPhone';
  if (!oneLine(draft.officeAddress.trim(), 200)) errors.officeAddress = 'company.invalidAddress';
  return errors;
}

/** The PUT body: every field, empty office details sent as null to clear them. */
export function companyPayload(version, draft) {
  const optional = (text) => text.trim() || null;
  return {
    version,
    displayName: draft.displayName.trim(),
    emirate: draft.emirate,
    tradeLicence: optional(draft.tradeLicence),
    officePhone: draft.officePhone.trim() ? phoneDigits(draft.officePhone.trim()) : null,
    officeAddress: optional(draft.officeAddress),
  };
}

export { FIELDS as companyFields };
