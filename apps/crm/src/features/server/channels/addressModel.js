/**
 * Sending-address rules, mirroring the server (services/crm-api/src/integrations/addresses/
 * rules.rs) so the Admin sees a problem before saving. The server still decides.
 */
const ROLES = new Set([
  'postmaster',
  'abuse',
  'mailer-daemon',
  'hostmaster',
  'webmaster',
  'noreply',
  'no-reply',
  'security',
  'admin',
  'support',
  'info',
  'dmarc',
  'bounce',
]);
const LOCAL = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
// Control, quote, angle bracket, backslash, @ and characters that render as nothing.
const HIDDEN =
  /[\p{Cc}"<>\\@\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\u{e0000}-\u{e007f}]/u;

/** Returns a catalogue key for the first problem, or '' when the local part is fine. */
export function localPartProblem(value) {
  const local = value.trim().toLowerCase();
  if (!LOCAL.test(local) || local.includes('..')) return 'emailAddresses.localInvalid';
  if (ROLES.has(local)) return 'emailAddresses.localRole';
  return '';
}

export function displayNameProblem(value) {
  const name = value.trim();
  const length = [...name].length;
  return length < 1 || length > 80 || HIDDEN.test(name) ? 'emailAddresses.nameInvalid' : '';
}

/**
 * The team list holds staff only, so the signed-in Admin is added first: the Admin also
 * sends from an address and must be able to give themselves one (owner feedback).
 */
export function withAdmin(members, admin) {
  if (!admin || members.some((member) => member.id === admin.id)) return members;
  return [{ id: admin.id, name: admin.name, status: 'active', roleId: 'admin' }, ...members];
}

/** Members who may send email (Admin, or staff with the email grant) and have no address. */
export function eligibleMembers(members, addresses) {
  const taken = new Set(
    addresses.filter((row) => row.state === 'active').map((row) => row.memberId),
  );
  return members.filter(
    (member) =>
      member.status === 'active' &&
      (member.roleId === 'admin' || member.channelAccess?.email === true) &&
      !taken.has(member.id),
  );
}

/** A suggested local part from a member's name: `Aidah Noor` → `aidah.noor`. */
export function suggestLocalPart(name = '') {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 64)
    .replace(/\.+$/, '');
}
