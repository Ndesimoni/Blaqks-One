// `POST /v3/mail/send` for the SendGrid stand-in (packet E3b). It keeps each accepted
// message for the suites to inspect. The recipient's local part picks a failure:
// `refuse…` answers 400, `crash…` answers 500, and `deliver-then-crash…` first posts a
// signed Delivered event and then answers 500 (review M1). Nothing is ever delivered.
import { randomBytes } from 'node:crypto';

export async function mailSend(request, response, { sent, domain, post }, json) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  let mail;
  try {
    mail = JSON.parse(raw);
  } catch {
    return json(response, 400, { errors: [{ message: 'invalid json' }] });
  }
  const to = mail.personalizations?.[0]?.to?.[0]?.email ?? '';
  if (to.startsWith('refuse')) return json(response, 400, { errors: [{ message: 'bad to' }] });
  if (to.startsWith('crash')) return json(response, 500, { errors: [] });
  if (to.startsWith('deliver-then-crash')) {
    const message = mail.custom_args?.inbox_message;
    await post(domain, [{ event: 'delivered', inbox_message: message, sg_event_id: message }]);
    return json(response, 500, { errors: [] });
  }
  const id = randomBytes(11).toString('base64url');
  sent.push({ id, to, mail });
  response.writeHead(202, { 'X-Message-Id': id });
  return response.end();
}
