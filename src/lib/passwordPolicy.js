/**
 * The new-password policy (docs/account-self-service.md), mirroring the server's
 * `auth/password_policy.rs`: at least 8 characters with an uppercase letter, a lowercase letter,
 * a number and a special character (neither a letter nor a number), at most 1024 bytes, and
 * different from the current password and the account email. The server stays authoritative.
 */
export const weakPasswordMessage =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.';

const bytes = (value) => new TextEncoder().encode(value).length;
const normal = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

/** Each rule with whether `password` meets it, in display order. */
export function passwordRules(password = '', { current, email } = {}) {
  const value = String(password);
  const rules = [
    { id: 'length', label: 'At least 8 characters', met: [...value].length >= 8 },
    { id: 'upper', label: 'An uppercase letter', met: /\p{Uppercase}/u.test(value) },
    { id: 'lower', label: 'A lowercase letter', met: /\p{Lowercase}/u.test(value) },
    { id: 'number', label: 'A number', met: /\p{N}/u.test(value) },
    {
      id: 'special',
      label: 'A special character, such as ! or #',
      met: /[^\p{Alphabetic}\p{N}]/u.test(value),
    },
  ];
  if (bytes(value) > 1024)
    rules.push({ id: 'bytes', label: 'No longer than 1024 bytes', met: false });
  if (current !== undefined)
    rules.push({
      id: 'current',
      label: 'Different from your current password',
      met: Boolean(value) && value !== current,
    });
  if (email)
    rules.push({
      id: 'email',
      label: 'Different from your email address',
      met: Boolean(value) && normal(value) !== normal(email),
    });
  return rules;
}

/** Whether `password` meets every rule. */
export function meetsPasswordPolicy(password, context) {
  return Boolean(password) && passwordRules(password, context).every((rule) => rule.met);
}
