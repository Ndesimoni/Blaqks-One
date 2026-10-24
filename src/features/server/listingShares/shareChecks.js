/**
 * When sending a listing needs the "I checked the text and links" tick (R2a security review
 * L8): the server's review warned about contact-like text or links, or the note looks like
 * a phone number or an email address. The same rule as `review::looks_like_contact` and
 * `review::sendable` in services/crm-api/src/agreements/listings/review.rs; the server
 * refuses a send that needed the tick without it.
 */
const CONFIRM = ['contact', 'links'];

/** An email address, or a run of nine or more digits (spaces, +, -, ( ), ., / allowed). */
export function looksLikeContact(text) {
  const value = String(text ?? '');
  const email = value.split(/\s+/).some((word) => {
    const at = word.indexOf('@');
    return at > 0 && word.slice(at + 1).includes('.');
  });
  const phone = value
    .split(/[^0-9 +\-()./\u00a0]/)
    .some((run) => (run.match(/[0-9]/g) || []).length >= 9);
  return email || phone;
}

/** Whether the send needs the tick, from the review's warnings and the typed note. */
export const needsCheck = (warnings = [], note = '') =>
  warnings.some((code) => CONFIRM.includes(code)) || looksLikeContact(note);
