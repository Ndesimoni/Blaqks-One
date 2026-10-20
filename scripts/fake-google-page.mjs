// The stand-in's sign-in page (E1d), for local trials and browser suites: a person types
// a pretend mailbox address instead of signing in to Google. It keeps every query value of
// the authorization request as hidden fields, so the CRM's state and PKCE stay intact.
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

export function consentPage(response, query) {
  // The form posts here, and its answer redirects to the CRM; both must be allowed.
  const back = new URL(query.get('redirect_uri') ?? 'http://invalid').origin;
  const hidden = [...query.entries()]
    .filter(([name]) => name !== 'email')
    .map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`)
    .join('');
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${back}`,
  });
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pretend Google sign-in</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:48px auto;padding:0 16px}
label,input,button{display:block;width:100%;box-sizing:border-box;margin-top:8px;font-size:16px}
input{padding:10px}button{padding:10px;margin-top:16px}p{color:#555}</style></head><body>
<h1>Pretend Google sign-in</h1>
<p>Local testing only. No real Google account is used and no real email is sent.</p>
<form method="get" action="/auth">${hidden}
<label for="email">Mailbox address</label>
<input id="email" name="email" type="email" required placeholder="aidah@keys-fixture.test">
<button type="submit">Allow the CRM to send and read email</button>
<button type="submit" name="deny" value="1" formnovalidate>Cancel</button>
</form></body></html>`);
}
