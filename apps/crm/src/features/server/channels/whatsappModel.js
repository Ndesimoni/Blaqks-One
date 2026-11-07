/**
 * WhatsApp through the company's Twilio account (W1a, docs/whatsapp-design.md §4 and §16).
 * The shape checks mirror the server so the Admin sees a slip before Twilio is asked; the
 * server and Twilio still decide.
 */
const SID = /^AC[0-9a-f]{32}$/;
const TOKEN = /^[0-9a-f]{32}$/;

/** The fields in the order they appear, so the first problem can take focus. */
export const TWILIO_FIELDS = ['label', 'sid', 'token'];

const sidProblem = (value) => {
  if (!value.trim()) return 'whatsappAccount.sidRequired';
  return SID.test(value.trim()) ? '' : 'whatsappAccount.sidInvalid';
};

const tokenProblem = (value) => {
  if (!value.trim()) return 'whatsappAccount.tokenRequired';
  return TOKEN.test(value.trim()) ? '' : 'whatsappAccount.tokenInvalid';
};

/**
 * Catalogue keys for each field's problem ('' when fine). Reconnecting asks for the new
 * Auth Token only, because the Account SID never changes.
 */
export function twilioProblems({ label = '', sid = '', token = '' }, connect) {
  return {
    label: connect && !label.trim() ? 'whatsappAccount.labelRequired' : '',
    sid: connect ? sidProblem(sid) : '',
    token: tokenProblem(token),
  };
}

/** The body the generic connect or reconnect route expects for a Twilio account. */
export function twilioBody({ label = '', sid = '', token = '' }, connection) {
  if (connection) return { expectedVersion: connection.version, credential: token.trim() };
  return {
    channel: 'whatsapp',
    provider: 'twilio',
    label: label.trim(),
    externalAccountId: sid.trim(),
    credential: token.trim(),
  };
}

const active = (numbers) => numbers.filter((number) => number.state === 'active');

/** The member's own active number, if the Admin gave them one. */
export const ownNumber = (numbers, memberId) =>
  active(numbers).find((number) => number.memberId === memberId) ?? null;

/**
 * Members who may be given a number: live members of the company with the WhatsApp grant,
 * and the Admin, who may give one to themselves (WQ3). Each holds at most one number.
 */
export function whatsappMembers(members, numbers) {
  const taken = new Set(active(numbers).map((number) => number.memberId));
  return members.filter(
    (member) =>
      member.status === 'active' &&
      (member.roleId === 'admin' || member.channelAccess?.whatsapp === true) &&
      !taken.has(member.id),
  );
}

/** Senders Twilio reports online and not connected anywhere, less any number given here. */
export function availableSenders(senders, numbers) {
  const taken = new Set(active(numbers).map((number) => number.phone));
  return senders.filter((sender) => sender.available === true && !taken.has(sender.phone));
}
