// Event Webhook settings for the SendGrid stand-in (packet E3b): create one webhook per
// domain, turn signing on with a fresh P-256 key pair, and delete it. `POST /test/events`
// signs a batch like SendGrid does (ECDSA over the timestamp and the raw body) and posts
// it to the stored URL, so the suites prove the CRM's verification end to end.
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';

const SETTINGS = '/v3/user/webhooks/event/settings';

export function createWebhooks() {
  const byDomain = new Map();
  const body = async (request) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  };
  /** The settings API; `null` when the path is not one of its routes. */
  async function settings(request, response, url, key, json) {
    if (!url.pathname.startsWith(SETTINGS)) return null;
    const input = await body(request);
    if (request.method === 'POST' && url.pathname === SETTINGS) {
      const hook = { id: randomUUID(), url: input.url, events: input };
      byDomain.set(key.domain, hook);
      return json(response, 201, { id: hook.id, url: hook.url, enabled: true });
    }
    const hook = byDomain.get(key.domain);
    if (request.method === 'PATCH' && hook && url.pathname === `${SETTINGS}/signed/${hook.id}`) {
      hook.keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const der = hook.keys.publicKey.export({ type: 'spki', format: 'der' });
      return json(response, 200, { id: hook.id, public_key: der.toString('base64') });
    }
    if (request.method === 'DELETE' && hook && url.pathname === `${SETTINGS}/${hook.id}`) {
      byDomain.delete(key.domain);
      response.writeHead(204);
      return response.end();
    }
    return json(response, 404, { errors: [{ message: 'not found' }] });
  }
  /** Signs `events` like SendGrid and posts them to the domain's webhook. */
  async function post(domain, events, { timestamp, signWith } = {}) {
    const hook = byDomain.get(domain);
    if (!hook?.keys) return null;
    const raw = JSON.stringify(events);
    const at = String(timestamp ?? Math.floor(Date.now() / 1000));
    const keys =
      signWith === 'other' ? generateKeyPairSync('ec', { namedCurve: 'prime256v1' }) : hook.keys;
    const signature = sign('sha256', Buffer.from(at + raw), keys.privateKey).toString('base64');
    const answer = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Twilio-Email-Event-Webhook-Signature': signature,
        'X-Twilio-Email-Event-Webhook-Timestamp': at,
      },
      body: raw,
    });
    return { status: answer.status, url: hook.url, events: hook.events };
  }
  /** `POST /test/events?domain=…`: posts the given batch and answers the CRM's status. */
  async function deliver(request, response, url, json) {
    const { events, ...options } = await body(request);
    const posted = await post(url.searchParams.get('domain'), events, options);
    return posted
      ? json(response, 200, posted)
      : json(response, 404, { error: 'no signed webhook' });
  }
  return { settings, deliver, post, byDomain };
}
