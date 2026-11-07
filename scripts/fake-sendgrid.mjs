// A loopback stand-in for the SendGrid API: key scopes and authenticated domains (E3a)
// and sending (E3b, fake-sendgrid-mail.mjs). The CRM reaches it only through CRM_SENDGRID_ENDPOINT, which the
// API accepts in local development alone. It is stateless: a synthetic key names what it
// can do, `SG.<kind>.<domain>`; `POST /test/revoke` with a domain makes its keys stop
// working. No real account exists and nothing is ever sent.
import { createServer } from 'node:http';
import { createWebhooks } from './fake-sendgrid-events.mjs';
import { mailSend } from './fake-sendgrid-mail.mjs';
import { createParse } from './fake-sendgrid-parse.mjs';

const SCOPES = [
  'mail.send',
  'whitelabel.read',
  'user.webhooks.parse.settings.create',
  '2fa_required',
];
const KINDS = {
  ok: { scopes: SCOPES, valid: true },
  broad: { scopes: [...SCOPES, 'api_keys.create'], valid: true },
  narrow: { scopes: ['mail.send'], valid: true },
  pending: { scopes: SCOPES, valid: false },
};

/** `SG.ok.keys.test` → the `ok` behaviour for the domain `keys.test`. */
export function parseKey(header = '') {
  const match = /^Bearer SG\.([a-z]+)\.([a-z0-9.-]+)$/.exec(header);
  if (!match) return null;
  const kind = KINDS[match[1]] ?? (match[1] === 'down' ? 'down' : null);
  return kind && { kind, domain: match[2] };
}

export async function startFakeSendgrid({ port }) {
  const calls = [];
  const sent = [];
  const revoked = new Set();
  const webhooks = createWebhooks();
  const parse = createParse(webhooks.body);
  const json = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/test/state') return json(response, 200, { calls, sent });
    if (url.pathname === '/test/revoke') {
      revoked.add(url.searchParams.get('domain'));
      return json(response, 200, {});
    }
    if (url.pathname === '/test/events') return webhooks.deliver(request, response, url, json);
    if (['/test/inbound', '/test/parse-preset', '/test/parse-quiet'].includes(url.pathname)) {
      return parse.deliver(request, response, url, json);
    }
    calls.push(url.pathname);
    const key = parseKey(request.headers.authorization);
    if (!key) return json(response, 401, { errors: [{ message: 'authorization required' }] });
    if (key.kind === 'down') return json(response, 503, { errors: [] });
    if (revoked.has(key.domain)) return json(response, 401, { errors: [{ message: 'revoked' }] });
    const handled = await webhooks.settings(request, response, url, key, json);
    if (handled !== null) return handled;
    const parsed = await parse.api(request, response, url, json);
    if (parsed !== null) return parsed;
    if (request.method === 'GET' && url.pathname === '/v3/scopes') {
      return json(response, 200, { scopes: key.kind.scopes });
    }
    if (request.method === 'GET' && url.pathname === '/v3/whitelabel/domains') {
      return json(response, 200, [
        { id: 1, domain: key.domain, subdomain: 'em1234', valid: key.kind.valid },
        { id: 2, domain: 'unverified.example.test', subdomain: 'em5678', valid: false },
      ]);
    }
    if (request.method === 'POST' && url.pathname === '/v3/mail/send') {
      return mailSend(request, response, { sent, domain: key.domain, post: webhooks.post }, json);
    }
    return json(response, 404, { errors: [{ message: 'not found' }] });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { close: () => new Promise((resolve) => server.close(resolve)) };
}
