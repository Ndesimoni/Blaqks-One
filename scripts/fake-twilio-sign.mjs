// Twilio's webhook signature for the loopback stand-in and the API suites (W1b,
// docs/whatsapp-design.md §6, W-L1): HMAC-SHA1 with the Auth Token over the full callback
// URL followed by every form parameter's name and value, sorted by name, then base64.
import { createHmac } from 'node:crypto';

/** The exact string Twilio signs for `url` and `params` (an object of strings). */
export function signedText(url, params) {
  const names = Object.keys(params).sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  );
  return names.reduce((text, name) => text + name + params[name], url);
}

/** The `X-Twilio-Signature` header value. */
export const signTwilio = (token, url, params) =>
  createHmac('sha1', token).update(signedText(url, params)).digest('base64');

/** Posts a signed form callback to `url` and answers its HTTP status. */
export async function postSigned(url, params, token, { signature, headers = {} } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': signature ?? signTwilio(token, url, params),
      ...headers,
    },
    body: new URLSearchParams(params).toString(),
  });
  await response.arrayBuffer();
  return response.status;
}
