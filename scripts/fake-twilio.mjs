// A loopback stand-in for the Twilio API (WhatsApp W1a and W1b, docs/whatsapp-design.md §9,
// §16 and §18): the account check, the WhatsApp senders list, content templates
// (fake-twilio-content.mjs) and message sends with signed status callbacks
// (fake-twilio-messages.mjs). The CRM reaches it only through CRM_TWILIO_ENDPOINT, which the
// API accepts in local development alone. Any well-formed Account SID (`AC` + 32 lower-case
// hex) with a well-formed Auth Token (32 hex) is an active account, except tokens starting
// `0000` (refused) and SIDs ending `dead` (suspended). Numbers use the unassigned country
// code +999, so nothing can reach a real phone: by default four senders per SID (the last
// `OFFLINE`); `POST /test/senders?sid=` (with `shape=empty` for a `{}` answer) and
// `/test/templates?sid=` set them, and
// `POST /test/revoke?sid=` makes the account refuse its token. Nothing reaches WhatsApp.
import { createServer } from 'node:http';
import { createContent } from './fake-twilio-content.mjs';
import { createMessages } from './fake-twilio-messages.mjs';
import { SENDERS, defaultSenders, sendersList } from './fake-twilio-senders.mjs';

export { defaultSenders };

const SID = /^AC[0-9a-f]{32}$/;
const TOKEN = /^[0-9a-f]{32}$/;

/** The account and token in a Basic header, or null when either is malformed. */
export function parseBasic(header = '') {
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header);
  if (!match) return null;
  const [sid, token, ...rest] = Buffer.from(match[1], 'base64').toString('utf8').split(':');
  return !rest.length && SID.test(sid) && TOKEN.test(token ?? '') ? { sid, token } : null;
}

export async function startFakeTwilio({ port }) {
  const origin = `http://127.0.0.1:${port}`;
  const configured = new Map();
  const broken = new Set();
  const revoked = new Set();
  const calls = [];
  const timers = new Set();
  const content = createContent(origin);
  const sendersFor = (sid) => (broken.has(sid) ? [] : (configured.get(sid) ?? defaultSenders(sid)));
  const messages = createMessages({ sendersFor, timers });
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
    // The test controls answer scripts only, never a web page (W1b review): a browser sends
    // an Origin, and only the stand-in's own may drive them.
    const from = request.headers.origin;
    if (
      url.pathname.startsWith('/test/') &&
      from &&
      from !== origin &&
      from !== `http://localhost:${port}`
    ) {
      return json(response, 403, { message: 'Forbidden' });
    }
    if (url.pathname === '/test/state') return json(response, 200, { calls, sent: messages.sent });
    if (request.method === 'POST' && url.pathname === '/test/revoke' && SID.test(sid ?? '')) {
      revoked.add(sid);
      return json(response, 200, {});
    }
    if (request.method === 'POST' && url.pathname === '/test/senders' && SID.test(sid ?? '')) {
      // `shape=empty` answers the senders list with `{}`, which is not Twilio's shape.
      if (url.searchParams.get('shape') === 'empty') broken.add(sid);
      else broken.delete(sid);
      configured.set(sid, await body(request));
      return json(response, 200, {});
    }
    if (request.method === 'POST' && url.pathname === '/test/templates' && SID.test(sid ?? '')) {
      content.set(sid, await body(request));
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
    const send = /^\/2010-04-01\/Accounts\/(AC[0-9a-f]{32})\/Messages\.json$/.exec(url.pathname);
    if (request.method === 'POST' && send) {
      return messages.send(request, response, auth, send[1], json);
    }
    if (request.method === 'GET' && url.pathname === content.path) {
      return content.list(response, url, auth, json);
    }
    if (request.method === 'GET' && url.pathname === SENDERS) {
      if (broken.has(auth.sid)) return json(response, 200, {});
      return sendersList(response, url, origin, sendersFor(auth.sid), auth.sid, json);
    }
    return json(response, 404, { code: 20404, message: 'Not found', status: 404 });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const close = () =>
    new Promise((resolve) => {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections?.();
      server.close(resolve);
    });
  return { close };
}
