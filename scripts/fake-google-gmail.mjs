// Gmail `users.messages.send` for the loopback Google stand-in (E1b). It decodes the raw
// message the CRM built and records it for the suites. Recipients starting `refused@`
// get a permanent 400 and `unclear@` a 500, so suites can drive each outcome.
import { randomBytes } from 'node:crypto';

const header = (text, name) =>
  text
    .split('\r\n\r\n')[0]
    .replace(/\r\n /g, ' ')
    .split('\r\n')
    .find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}: `))
    ?.slice(name.length + 2);

const decodeWords = (value = '') =>
  value.replace(/=\?UTF-8\?B\?([^?]*)\?=\s?/g, (_, data) =>
    Buffer.from(data, 'base64').toString('utf8'),
  );

export async function gmailSend(request, response, { email, json, sent }) {
  let text = '';
  for await (const chunk of request) text += chunk;
  const { raw, threadId } = JSON.parse(text);
  const message = Buffer.from(raw, 'base64url').toString('utf8');
  const to = header(message, 'To');
  if (to?.startsWith('refused@')) return json(response, 400, { error: 'invalidArgument' });
  if (to?.startsWith('unclear@')) return json(response, 500, { error: 'backendError' });
  const body = Buffer.from(message.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64');
  const id = randomBytes(8).toString('hex');
  const thread = threadId ?? randomBytes(8).toString('hex');
  sent.push({
    id,
    from: email,
    to,
    subject: decodeWords(header(message, 'Subject')),
    inReplyTo: header(message, 'In-Reply-To') ?? null,
    threadId: thread,
    body: body.toString('utf8'),
    headers: message.split('\r\n\r\n')[0],
  });
  return json(response, 200, { id, threadId: thread, labelIds: ['SENT'] });
}
