// Inbound Parse for the SendGrid stand-in (packet E3c): signature policies with fresh
// P-256 keys, one Parse setting per hostname that is never overwritten, and
// `POST /test/inbound?domain=…`, which posts a signed multipart form like SendGrid does
// (ECDSA over the timestamp and the raw body). `POST /test/parse-preset?domain=…` claims a
// hostname first, to prove the CRM never takes over an existing setting.
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

const POLICIES = '/v3/user/webhooks/security/policies';
const PARSE = '/v3/user/webhooks/parse/settings';
const pair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

function multipart(fields, attachments) {
  const boundary = `xYz${randomBytes(8).toString('hex')}`;
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  for (let n = 1; n <= attachments; n += 1) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="attachment${n}"; ` +
        `filename="plan${n}.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\r\n`,
    );
  }
  return { boundary, raw: Buffer.from(`${parts.join('')}--${boundary}--\r\n`) };
}

export function createParse(body) {
  const policies = new Map();
  const settings = new Map();
  async function api(request, response, url, json) {
    if (request.method === 'POST' && url.pathname === POLICIES) {
      const policy = { id: randomUUID(), keys: pair() };
      policies.set(policy.id, policy);
      const der = policy.keys.publicKey.export({ type: 'spki', format: 'der' });
      const signature = { enabled: true, public_key: der.toString('base64') };
      return json(response, 201, { policy: { id: policy.id, signature } });
    }
    if (request.method === 'POST' && url.pathname === PARSE) {
      const input = await body(request);
      const policy = policies.get(input.security_policy);
      if (settings.has(input.hostname) || !policy) return json(response, 400, { errors: [] });
      settings.set(input.hostname, { url: input.url, keys: policy.keys, input });
      return json(response, 201, { hostname: input.hostname, url: input.url });
    }
    if (request.method === 'DELETE' && url.pathname.startsWith(`${PARSE}/`)) {
      settings.delete(url.pathname.slice(PARSE.length + 1));
      response.writeHead(204);
      return response.end();
    }
    return null;
  }
  async function deliver(request, response, url, json) {
    const hostname = url.searchParams.get('domain');
    if (url.pathname === '/test/parse-preset') {
      settings.set(hostname, { url: 'http://127.0.0.1:1/elsewhere', keys: pair(), input: {} });
      return json(response, 200, {});
    }
    const setting = settings.get(hostname);
    if (!setting) return json(response, 404, { error: 'no parse setting' });
    const { fields, attachments = 0, timestamp, signWith } = await body(request);
    const { boundary, raw } = multipart(fields, attachments);
    const at = String(timestamp ?? Math.floor(Date.now() / 1000));
    const keys = signWith === 'other' ? pair() : setting.keys;
    const signed = Buffer.concat([Buffer.from(at), raw]);
    const answer = await fetch(setting.url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'X-Twilio-Email-Event-Webhook-Signature': sign('sha256', signed, keys.privateKey).toString(
          'base64',
        ),
        'X-Twilio-Email-Event-Webhook-Timestamp': at,
      },
      body: raw,
    });
    return json(response, 200, { status: answer.status, url: setting.url, input: setting.input });
  }
  return { api, deliver };
}
