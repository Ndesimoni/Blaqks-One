// Message sends for the Twilio stand-in (W1b, docs/whatsapp-design.md §9 and §18):
// `POST /2010-04-01/Accounts/{sid}/Messages.json` answers `201` with an `SM…` ID, then posts
// signed `sent`, `delivered` and `read` callbacks to the StatusCallback URL. A `From` that is
// not an online sender of the account is `400` 63007. Reserved synthetic recipients:
import { randomBytes } from 'node:crypto';
import { postSigned } from './fake-twilio-sign.mjs';

export const RESERVED = {
  notOnWhatsapp: '+99900000001', // accepted, then `undelivered` with 63003
  outsideWindow: '+99900000002', // `400` with 63016
  timeout: '+99900000003', // accepted but never answered (the CRM times out: unknown)
  limited: '+99900000004', // `429` with Retry-After on the first attempt of each message
  quiet: '+99900000006', // accepted with no callbacks, so tests post their own
};

const readForm = async (request) => {
  let text = '';
  for await (const chunk of request) text += chunk;
  return new URLSearchParams(text);
};

export function createMessages({ sendersFor, timers }) {
  const sent = [];
  const limited = new Set();
  async function callbacks(record, token, statuses) {
    for (const [status, errorCode] of statuses) {
      await new Promise((resolve) => timers.add(setTimeout(resolve, 25)));
      const params = {
        AccountSid: record.account,
        ApiVersion: '2010-04-01',
        ChannelPrefix: 'whatsapp',
        From: record.from,
        MessageSid: record.sid,
        MessageStatus: status,
        SmsSid: record.sid,
        SmsStatus: status,
        To: record.to,
        ...(errorCode ? { ErrorCode: errorCode } : {}),
      };
      record.callbacks.push(status);
      await postSigned(record.statusCallback, params, token).catch(() => null);
    }
  }
  async function send(request, response, auth, account, json) {
    if (account !== auth.sid) return json(response, 404, { code: 20404, status: 404 });
    const form = await readForm(request);
    const record = {
      account,
      fields: [...form.keys()],
      from: form.get('From'),
      to: form.get('To'),
      body: form.get('Body'),
      contentSid: form.get('ContentSid'),
      contentVariables: form.get('ContentVariables'),
      statusCallback: form.get('StatusCallback'),
      callbacks: [],
    };
    sent.push(record);
    const refuse = (status, code) => {
      record.answer = status;
      json(response, status, { code, message: 'Synthetic refusal', status });
    };
    const from = (record.from ?? '').replace(/^whatsapp:/, '');
    const to = (record.to ?? '').replace(/^whatsapp:/, '');
    const online = sendersFor(account).some((s) => s.phone === from && s.status === 'ONLINE');
    if (!record.from?.startsWith('whatsapp:+') || !online) return refuse(400, 63007);
    if (!record.to?.startsWith('whatsapp:+')) return refuse(400, 21211);
    if (to === RESERVED.outsideWindow) return refuse(400, 63016);
    const attempt = record.statusCallback ?? to;
    if (to === RESERVED.limited && !limited.has(attempt)) {
      limited.add(attempt);
      record.answer = 429;
      response.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '1' });
      return response.end(JSON.stringify({ code: 20429, status: 429 }));
    }
    record.sid = `SM${randomBytes(16).toString('hex')}`;
    if (to === RESERVED.timeout) {
      record.answer = 'timeout';
      timers.add(setTimeout(() => request.socket.destroy(), 15_000));
      return;
    }
    record.answer = 201;
    json(response, 201, { sid: record.sid, status: 'queued', account_sid: account });
    if (!record.statusCallback || to === RESERVED.quiet) return;
    const statuses =
      to === RESERVED.notOnWhatsapp
        ? [['undelivered', '63003']]
        : [['sent'], ['delivered'], ['read']];
    callbacks(record, auth.token, statuses);
  }
  return { send, sent };
}
