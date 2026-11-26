/** Fixtures for the public webhook suite (packet X2): signed stub events. */
import { createHmac, randomUUID } from 'node:crypto';
import { api, query } from './helpers.mjs';

export const webhookUrl = (provider = 'stub') =>
  `${api.replace(/\/api\/crm$/, '')}/api/integrations/webhooks/${provider}`;

/** The stub signs `<event ID>.<raw body>`, so the deduplication key is signed too. */
export const sign = (secret, message) =>
  `sha256=${createHmac('sha256', secret).update(message).digest('hex')}`;

/** POSTs raw `body` with stub headers; `overrides` replaces or removes (`null`) headers. */
export async function deliver(
  { account, secret, body, event = `evt-${randomUUID()}` },
  { provider, ...overrides } = {},
) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Stub-Provider': 'meta',
    'X-Stub-Account': account,
    'X-Stub-Event': event,
    'X-Stub-Signature': sign(secret, `${event}.${body}`),
    ...overrides,
  };
  for (const [name, value] of Object.entries(headers)) if (value === null) delete headers[name];
  const response = await fetch(webhookUrl(provider), { method: 'POST', headers, body });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text, event };
}

/** `receipts|staging` row counts for one event ID. */
export const rows = (event) =>
  query(
    `SELECT (SELECT count(*) FROM integrations.crm_webhook_receipts WHERE event_id='${event}')
       ||'|'||(SELECT count(*) FROM integrations.crm_webhook_staging s
         JOIN integrations.crm_webhook_receipts r ON r.id=s.receipt_id WHERE r.event_id='${event}')`,
  );
