// `POST /v3/mail/send` for the SendGrid stand-in (packet E3b). It keeps each accepted
// message for the suites to inspect. The recipient's local part picks a failure:
// `refuse…` answers 400 and `crash…` answers 500. Nothing is ever delivered.
import { randomBytes } from 'node:crypto';

export async function mailSend(request, response, key, { sent, revoked }, json) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  if (revoked.has(key.domain)) return json(response, 401, { errors: [{ message: 'revoked' }] });
  let mail;
  try {
    mail = JSON.parse(raw);
  } catch {
    return json(response, 400, { errors: [{ message: 'invalid json' }] });
  }
  const to = mail.personalizations?.[0]?.to?.[0]?.email ?? '';
  if (to.startsWith('refuse')) return json(response, 400, { errors: [{ message: 'bad to' }] });
  if (to.startsWith('crash')) return json(response, 500, { errors: [] });
  const id = randomBytes(11).toString('base64url');
  sent.push({ id, to, mail });
  response.writeHead(202, { 'X-Message-Id': id });
  return response.end();
}
