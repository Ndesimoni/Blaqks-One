// A loopback stand-in for the Twilio API (WhatsApp W1a, docs/whatsapp-design.md §9 and §16):
// the account check and the WhatsApp senders list. The CRM reaches it only through
// CRM_TWILIO_ENDPOINT, which the API accepts in local development alone. Any well-formed
// Account SID (`AC` + 32 lower-case hex) with a well-formed Auth Token (32 hex) is an
// active account, except tokens starting `0000` (refused) and SIDs ending `dead`
// (suspended). Senders use the unassigned country code +999, so nothing can reach a real
// phone: by default four per SID (the last `OFFLINE`); `POST /test/senders?sid=` sets
// them and `POST /test/revoke?sid=` makes the account refuse its token. Nothing is sent.
import { createServer } from 'node:http';

const SID = /^AC[0-9a-f]{32}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const SENDERS = '/v2/Channels/Senders';

/** The account and token in a Basic header, or null when either is malformed. */
export function parseBasic(header = '') {
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header);
  if (!match) return null;
  const [sid, token, ...rest] = Buffer.from(match[1], 'base64').toString('utf8').split(':');
  return !rest.length && SID.test(sid) && TOKEN.test(token ?? '') ? { sid, token } : null;
}

/** Four synthetic +999 senders that differ per account; the last is OFFLINE. */
export function defaultSenders(sid) {
  const base = String(parseInt(sid.slice(-7), 16) % 1_000_000).padStart(6, '0');
  return [1, 2, 3, 4].map((index) => ({
    phone: `+99950${base}${index}`,
    status: index === 4 ? 'OFFLINE' : 'ONLINE',
  }));
}

const hex = (seed) =>
  Buffer.from(seed.padEnd(16, '0').slice(0, 16), 'utf8').toString('hex').slice(0, 32);

function senderView(origin, sid, { phone, status }) {
  const id = `XE${hex(`${sid.slice(-8)}${phone.slice(-8)}`)}`;
  return {
    sid: id,
    status,
    sender_id: `whatsapp:${phone}`,
    configuration: { waba_id: 'synthetic-waba' },
    profile: { name: 'Synthetic sender' },
    webhook: { callback_url: null, fallback_url: null, status_callback_url: null },
    url: `${origin}${SENDERS}/${id}`,
  };
}

export async function startFakeTwilio({ port }) {
  const origin = `http://127.0.0.1:${port}`;
  const configured = new Map();
  const revoked = new Set();
  const calls = [];
  const json = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  const refuse = (response) =>
    json(response, 401, { code: 20003, message: 'Authenticate', status: 401 });
  const body = async (request) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    try {
      const list = JSON.parse(text);
      return Array.isArray(list) ? list : null;
    } catch {
      return null;
    }
  };
  const server = createServer(async (request, response) => {
    // Loopback names only, so a rebinding web page cannot drive the stand-in.
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) {
      return json(response, 421, { message: 'Misdirected request' });
    }
    const url = new URL(request.url, origin);
    const sid = url.searchParams.get('sid');
    if (url.pathname === '/test/state') return json(response, 200, { calls });
    if (request.method === 'POST' && url.pathname === '/test/revoke' && SID.test(sid ?? '')) {
      revoked.add(sid);
      return json(response, 200, {});
    }
    if (request.method === 'POST' && url.pathname === '/test/senders' && SID.test(sid ?? '')) {
      configured.set(sid, await body(request));
      return json(response, 200, {});
    }
    calls.push(`${request.method} ${url.pathname}`);
    const auth = parseBasic(request.headers.authorization);
    if (!auth || auth.token.startsWith('0000') || revoked.has(auth.sid)) return refuse(response);
    const account = /^\/2010-04-01\/Accounts\/(AC[0-9a-f]{32})\.json$/.exec(url.pathname);
    if (request.method === 'GET' && account) {
      if (account[1] !== auth.sid) return json(response, 404, { code: 20404, status: 404 });
      return json(response, 200, {
        sid: auth.sid,
        friendly_name: 'Synthetic Twilio account',
        status: auth.sid.endsWith('dead') ? 'suspended' : 'active',
        type: 'Full',
      });
    }
    if (request.method === 'GET' && url.pathname === SENDERS) {
      if (url.searchParams.get('Channel') !== 'whatsapp') return json(response, 400, {});
      const size = Math.min(Number(url.searchParams.get('PageSize')) || 50, 50);
      const page = Number(url.searchParams.get('Page')) || 0;
      const all = configured.get(auth.sid) ?? defaultSenders(auth.sid);
      const senders = all.slice(page * size, (page + 1) * size);
      const more = (page + 1) * size < all.length;
      const link = (index) =>
        `${origin}${SENDERS}?Channel=whatsapp&PageSize=${size}&Page=${index}&PageToken=PT${index}`;
      return json(response, 200, {
        senders: senders.map((sender) => senderView(origin, auth.sid, sender)),
        meta: {
          page,
          page_size: size,
          first_page_url: link(0),
          previous_page_url: page ? link(page - 1) : null,
          url: link(page),
          next_page_url: more ? link(page + 1) : null,
          key: 'senders',
        },
      });
    }
    return json(response, 404, { code: 20404, message: 'Not found', status: 404 });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { close: () => new Promise((resolve) => server.close(resolve)) };
}
