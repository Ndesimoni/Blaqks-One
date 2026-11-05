// A loopback stand-in for Google's sign-in, token, revoke and Gmail profile endpoints
// (packet E1). The CRM reaches it only through CRM_GOOGLE_ENDPOINT, which the API accepts
// in local development alone. It checks PKCE, the client and the exact redirect URI the
// way Google does, and records revocations so suites can assert on them. No real account.
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { gmailSend } from './fake-google-gmail.mjs';
import { createMailboxes } from './fake-google-mailbox.mjs';
import { consentPage } from './fake-google-page.mjs';

const SEND = 'https://www.googleapis.com/auth/gmail.send';
const READ = 'https://www.googleapis.com/auth/gmail.readonly';
const token = (prefix) => `${prefix}-${randomBytes(18).toString('base64url')}`;

export async function startFakeGoogle({ port, clientId, clientSecret, redirectUri }) {
  const codes = new Map();
  const access = new Map();
  const refresh = new Map();
  const revoked = [];
  const sent = [];
  const mailboxes = createMailboxes();
  const json = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  const form = async (request) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    return new URLSearchParams(body);
  };
  // A test "consents" by calling the authorize URL with x-test-* headers instead of a page.
  const authorize = (request, response, url) => {
    const query = url.searchParams;
    if (query.get('client_id') !== clientId || query.get('redirect_uri') !== redirectUri) {
      return json(response, 400, { error: 'redirect_uri_mismatch' });
    }
    // A browser without the test headers gets the pretend sign-in page first.
    const typed = query.get('email');
    const asked =
      request.headers['x-test-email'] ||
      request.headers['x-test-deny'] ||
      typed ||
      query.get('deny');
    if (!asked) return consentPage(response, query);
    const deny = request.headers['x-test-deny'] || query.get('deny');
    const back = new URL(redirectUri);
    back.searchParams.set('state', query.get('state') ?? '');
    if (deny) {
      back.searchParams.set('error', 'access_denied');
    } else {
      const code = token('4/code');
      const scope = request.headers['x-test-scope'] ?? query.get('scope');
      codes.set(code, {
        email: String(request.headers['x-test-email'] ?? typed).toLowerCase(),
        scope,
        challenge: query.get('code_challenge'),
        noRefresh: Boolean(request.headers['x-test-no-refresh']),
      });
      back.searchParams.set('code', code);
    }
    response.writeHead(302, { Location: back.toString() });
    response.end();
  };
  const exchange = (response, body) => {
    if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret) {
      return json(response, 401, { error: 'invalid_client' });
    }
    if (body.get('grant_type') === 'refresh_token') {
      const email = refresh.get(body.get('refresh_token'));
      if (!email || revoked.includes(body.get('refresh_token'))) {
        return json(response, 400, { error: 'invalid_grant' });
      }
      const next = token('at');
      access.set(next, email);
      return json(response, 200, {
        access_token: next,
        expires_in: 3599,
        scope: `${SEND} ${READ}`,
      });
    }
    const grant = codes.get(body.get('code'));
    codes.delete(body.get('code'));
    const proof = createHash('sha256')
      .update(body.get('code_verifier') ?? '')
      .digest('base64url');
    if (!grant || proof !== grant.challenge || body.get('redirect_uri') !== redirectUri) {
      return json(response, 400, { error: 'invalid_grant' });
    }
    const [accessToken, refreshToken] = [token('at'), token('1//rt')];
    access.set(accessToken, grant.email);
    refresh.set(refreshToken, grant.email);
    return json(response, 200, {
      access_token: accessToken,
      expires_in: 3599,
      scope: grant.scope,
      ...(grant.noRefresh ? {} : { refresh_token: refreshToken }),
    });
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fake-google.test');
    const bearer = request.headers.authorization?.replace(/^Bearer /, '');
    if (request.method === 'GET' && url.pathname === '/auth') {
      return authorize(request, response, url);
    }
    if (request.method === 'POST' && url.pathname === '/token') {
      return exchange(response, await form(request));
    }
    if (request.method === 'POST' && url.pathname === '/revoke') {
      revoked.push((await form(request)).get('token'));
      return json(response, 200, {});
    }
    if (request.method === 'GET' && url.pathname === '/gmail/v1/users/me/profile') {
      const email = access.get(bearer);
      if (!email) return json(response, 401, { error: 'unauthenticated' });
      if (email.startsWith('oversized@')) {
        // A chunked body with no length, larger than the CRM accepts (review L1).
        response.writeHead(200, { 'Content-Type': 'application/json' });
        for (let index = 0; index < 20; index += 1) response.write(' '.repeat(8192));
        return response.end('{}');
      }
      return json(response, 200, { emailAddress: email, historyId: mailboxes.current() });
    }
    if (request.method === 'POST' && url.pathname === '/gmail/v1/users/me/messages/send') {
      const email = access.get(bearer);
      if (!email) return json(response, 401, { error: 'unauthenticated' });
      return gmailSend(request, response, { email, json, sent, mailboxes });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/gmail/')) {
      const email = access.get(bearer);
      const answer = email ? mailboxes.route(url, email) : [401, { error: 'unauthenticated' }];
      if (answer) return json(response, ...answer);
    }
    if (request.method === 'POST' && url.pathname === '/test/deliver') {
      let text = '';
      for await (const chunk of request) text += chunk;
      return json(response, 200, mailboxes.deliver(JSON.parse(text)));
    }
    if (request.method === 'GET' && url.pathname === '/test/state') {
      return json(response, 200, { revoked, refreshTokens: [...refresh.keys()], sent });
    }
    json(response, 404, { error: 'not_found' });
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { close: () => new Promise((resolve) => server.close(resolve)) };
}
