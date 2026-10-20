// Pretend Gmail mailboxes for the loopback Google stand-in (E1c): a history of added
// messages, metadata and full message reads, and a test-only `POST /test/deliver` that
// drops a client's email into a mailbox. Synthetic data only.
import { randomBytes } from 'node:crypto';

const id = () => randomBytes(8).toString('hex');
/** The domain of `Name <a@b>` or `a@b`. */
const domainOf = (from = '') => String(from).replace(/.*</, '').replace(/>.*/, '').split('@')[1];
const b64 = (text) => Buffer.from(text, 'utf8').toString('base64url');

export function createMailboxes() {
  let historyId = 1000;
  const messages = new Map();
  const history = [];
  const add = (email, message) => {
    historyId += 1;
    messages.set(message.id, { ...message, email });
    history.push({ id: historyId, email, message });
    return message;
  };
  const view = (stored, format) => {
    const headers = [
      ['From', stored.from],
      ['To', stored.to],
      ['Subject', stored.subject],
      ['Message-ID', stored.messageId],
      ['Content-Type', stored.contentType],
      // Gmail's own sender check; `unverified` mail imitates a forged From (DMARC fail).
      [
        'Authentication-Results',
        stored.unverified
          ? // The review's bypass attempt: sender-controlled text that reads "dmarc=pass".
            'mx.google.com; spf=pass (google.com: domain of dmarc=pass@evil.example) ' +
            `smtp.mailfrom="dmarc=pass@evil.example"; dmarc=fail (p=NONE) header.from=${domainOf(stored.from)}`
          : `mx.google.com; dkim=pass; spf=pass; dmarc=pass (p=NONE) header.from=${domainOf(stored.from)}`,
      ],
    ]
      .filter(([, value]) => value)
      .map(([name, value]) => ({ name, value }));
    const payload = { mimeType: stored.contentType ?? 'text/plain', headers };
    if (format === 'full' && stored.oversized) return { padding: 'x'.repeat(3 * 1024 * 1024) };
    if (format === 'full') {
      const parts = [
        {
          mimeType: stored.html ? 'text/html' : 'text/plain',
          body: { data: b64(stored.html ?? stored.text ?? '') },
        },
      ];
      if (stored.dsn)
        parts.push({
          mimeType: 'message/delivery-status',
          body: { data: b64(`Reporting-MTA: dns; googlemail.com\nStatus: ${stored.dsn}\n`) },
        });
      if (stored.attachment)
        parts.push({
          mimeType: 'application/pdf',
          filename: stored.attachment,
          body: { attachmentId: 'att-1' },
        });
      Object.assign(payload, { mimeType: 'multipart/mixed', parts });
    }
    return { id: stored.id, threadId: stored.threadId, labelIds: stored.labels, payload };
  };
  return {
    current: () => String(historyId),
    /** A message the CRM sent: kept under SENT so a later reply can share its thread. */
    sent: (email, threadId) => add(email, { id: id(), threadId, labels: ['SENT'] }),
    deliver(body) {
      const message = {
        id: id(),
        threadId: body.threadId ?? id(),
        labels: ['INBOX'],
        from: body.from,
        to: body.to,
        subject: body.subject,
        messageId: body.messageId ?? `<${id()}@mail.example.test>`,
        text: body.text,
        html: body.html,
        contentType: body.contentType,
        attachment: body.attachment,
        unverified: body.unverified,
        dsn: body.dsn,
        oversized: body.oversized,
      };
      return add(String(body.to).toLowerCase(), message);
    },
    /** Answers the Gmail read routes for `email`; `null` when the path is not one. */
    route(url, email) {
      if (url.pathname === '/gmail/v1/users/me/history') {
        const start = Number(url.searchParams.get('startHistoryId'));
        if (!Number.isFinite(start) || start < 1000) return [404, { error: 'notFound' }];
        const entries = history
          .filter((entry) => entry.email === email && entry.id > start)
          .map((entry) => ({
            id: String(entry.id),
            messagesAdded: [
              {
                message: {
                  id: entry.message.id,
                  threadId: entry.message.threadId,
                  labelIds: entry.message.labels,
                },
              },
            ],
          }));
        return [200, { history: entries, historyId: String(historyId) }];
      }
      const match = url.pathname.match(/^\/gmail\/v1\/users\/me\/messages\/([a-f0-9]+)$/);
      if (!match) return null;
      const stored = messages.get(match[1]);
      if (!stored || stored.email !== email) return [404, { error: 'notFound' }];
      return [200, view(stored, url.searchParams.get('format'))];
    },
  };
}
