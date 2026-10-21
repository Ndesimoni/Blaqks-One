import { get } from '../../../lib/records.js';
import { canReplyOn } from './inboxModel.js';
import { linkCandidates } from './triageModel.js';

/**
 * Whether the composer can send, or which notice explains why not (E1d). Email replies go
 * only through the conversation's own mailbox, by its owner (decision O9).
 */
/**
 * What a member sends through (E3d): the company's SendGrid account with their own
 * address when the company uses SendGrid, otherwise their own Google mailbox.
 */
export function sendingMailbox(data) {
  const company = data?.companyEmail;
  if (!company) return data?.mailbox ?? null;
  if (!company.address) return { company: true, state: 'needAddress' };
  return {
    company: true,
    id: company.connectionId,
    state: company.connected ? 'connected' : 'companyReconnect',
    label: company.address,
  };
}

export function replyState({ conversation, user, mailbox, health }) {
  const channel = conversation.channel;
  if (channel !== 'email') {
    if (health === 'off') return 'disconnected';
    return canReplyOn(user, channel) ? 'comingSoon' : 'noPermission';
  }
  if (!canReplyOn(user, channel)) return 'noPermission';
  if (!mailbox) return 'connectMailbox';
  if (['needAddress', 'companyReconnect'].includes(mailbox.state)) return mailbox.state;
  if (mailbox.state !== 'connected') return 'reconnect';
  if (conversation.connectionId !== mailbox.id) return 'otherMailbox';
  return 'send';
}

/** The author's own failed or unknown message, not yet sent again. */
export function canSendAgain(message, messages, userId) {
  return (
    message.direction === 'outbound' &&
    message.authorId === userId &&
    ['failed', 'unknown'].includes(message.status) &&
    !messages.some((other) => other.repeatOf === message.id)
  );
}

const plainEmail = (value) => /^[^\s@"<>,;:\\()[\]]+@[^\s@"<>,;:\\()[\]]+\.[^\s@]+$/.test(value);

/** Clients and Contacts with a usable email address that match the search. */
export function emailRecipients(entries, query) {
  const withEmail = {
    Clients: (entries?.Clients || []).filter((entry) => plainEmail(get(entry.record, 'Email'))),
    Contacts: (entries?.Contacts || []).filter((entry) => plainEmail(get(entry.record, 'Email'))),
  };
  return linkCandidates(withEmail, query).slice(0, 12);
}

/** An email reply split into the new text and the quoted earlier mail, which folds. */
export function splitQuoted(body = '') {
  const lines = body.split('\n');
  const index = lines.findIndex(
    (line, at) => /^On .+wrote:\s*$/.test(line.trim()) || (line.startsWith('>') && at > 0),
  );
  if (index <= 0) return { text: body, quoted: '' };
  return {
    text: lines.slice(0, index).join('\n').trimEnd(),
    quoted: lines.slice(index).join('\n'),
  };
}
