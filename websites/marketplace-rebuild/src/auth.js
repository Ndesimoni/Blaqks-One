import { escapeHTML as esc } from './data.js';

export const account = { name: '', email: '', company: '', invites: '' };

function field(label, name, type = 'text', extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
}

export function authPage(route) {
  const shared = '<p class="sample-note">Design preview only. No account is created and no email is sent.</p>';
  let title = '', kicker = '', body = '';
  if (route === 'signup' || route === 'signin') {
    const signup = route === 'signup';
    kicker = signup ? 'YOUR NEXT CHAPTER STARTS HERE' : 'GOOD TO HAVE YOU BACK';
    title = signup ? 'Make room for<br>what’s next.' : 'Welcome<br>back.';
    body = `<p>${signup ? 'Create your professional Blaqks One workspace.' : 'Continue to your professional workspace.'}</p>
      <div class="social-buttons"><button data-provider="Facebook">Continue with Facebook</button>
      <button data-provider="Apple">Continue with Apple</button></div><p class="divider">or continue with email</p>
      <form id="auth-form" data-stage="${route}">
      ${signup ? field('Full name', 'name', 'text', 'autocomplete="name"') : ''}
      ${field('Work email', 'email', 'email', 'autocomplete="email"')}
      <label>Password<div class="password-field"><input id="password" name="password" type="password"
        minlength="8" required autocomplete="${signup ? 'new-password' : 'current-password'}">
      <button type="button" data-password aria-label="Show password">Show</button></div></label>
      ${signup ? '<p class="field-note">At least 8 characters. Do not use a real password in this preview.</p>' :
        '<a href="#reset">Forgot password?</a>'}
      <button class="button navy wide">${signup ? 'Create your workspace' : 'Sign in'} →</button></form>
      <p>${signup ? 'Already have an account? <a href="#signin">Sign in</a>' :
        'New to Blaqks One? <a href="#signup">Create an account</a>'}</p>`;
  } else if (route === 'verify') {
    kicker = 'ONE QUICK CHECK';
    title = 'Check your<br>inbox.';
    body = `<p>Verification preview for <strong>${esc(account.email || 'you@company.com')}</strong>.</p>
      <form id="auth-form" data-stage="verify">${field('Six-digit code', 'code', 'text',
        'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')}
      <p class="field-note">Use the preview code 246810.</p>
      <button class="button navy wide">Verify email →</button><p id="auth-error" role="alert"></p></form>
      <button data-resend>Resend preview code</button><a href="#expired">View expired-code state</a>`;
  } else if (route === 'company') {
    kicker = 'STEP 2 OF 3';
    title = 'A space for<br>your business.';
    body = `<form id="auth-form" data-stage="company">${field('Company name', 'company')}
      ${field('Workspace name', 'workspace', 'text', 'pattern="[a-z0-9-]+"')}
      <p class="field-note">Workspace name: lowercase letters, numbers and hyphens.</p>
      <label>Team size<select name="size"><option>Just me</option><option>2–10</option>
      <option>11–50</option><option>51+</option></select></label>
      <button class="button navy wide">Continue →</button></form>`;
  } else if (route === 'invite') {
    kicker = 'STEP 3 OF 3';
    title = 'Good things<br>happen together.';
    body = `<p>Introduce your team to ${esc(account.company || 'your workspace')}.</p>
      <form id="auth-form" data-stage="invite"><label>Teammate email
      <input name="invite" type="email" placeholder="colleague@company.com"></label>
      <button class="button navy wide">Preview invitation →</button></form>
      <a href="#ready">Skip for now</a>`;
  } else if (route === 'ready' || route === 'workspace') {
    kicker = 'A FRESH START';
    title = 'Your next chapter.<br>Ready for you.';
    body = `<p>${esc(account.company || 'Your workspace')} is ready in this design preview.</p>
      <div class="onboarding-checklist"><p>✓ Account preview</p><p>✓ Email verification preview</p>
      <p>✓ Company setup preview</p></div><p>The live CRM is separate and is not connected here.</p>
      <a class="button navy wide" href="#home">Explore the marketplace →</a>`;
  } else if (route === 'expired') {
    kicker = 'ONE MORE QUICK CHECK';
    title = 'Let’s send<br>a fresh code.';
    body = '<p>This preview code has expired.</p><a class="button navy" href="#verify">Request a new preview code →</a>';
  } else if (route === 'reset-sent') {
    kicker = 'CHECK YOUR EMAIL';
    title = 'A fresh start<br>is on its way.';
    body = '<p>Password recovery design preview. No reset email has been sent.</p><a href="#signin">Back to sign in →</a>';
  } else {
    kicker = 'A LITTLE HELP';
    title = 'Let’s get you<br>back in.';
    body = `<form id="auth-form" data-stage="reset">${field('Email address', 'email', 'email')}
      <button class="button navy wide">Preview reset email →</button></form><a href="#signin">Back to sign in</a>`;
  }
  return `<main id="main" class="auth-shell"><aside><a class="brand" href="#home">BLAQKS ONE</a>
    <div><p class="eyebrow">THOUGHTFULLY CONNECTED.</p><h2>A little clarity.<br>A world of possibility.</h2>
    <p>Your properties and professional connections, with room to grow.</p></div><small>FOR AGENTS & COMPANIES</small></aside>
    <section class="auth-form"><a href="#home" class="auth-back">← Back to website</a>
    <p class="eyebrow">${kicker}</p><h1 id="page-title" tabindex="-1">${title}</h1>${body}${shared}</section></main>`;
}

export function submitAccount(form) {
  const data = new FormData(form);
  const stage = form.dataset.stage;
  if (stage === 'signup' || stage === 'signin') {
    account.name = data.get('name') || '';
    account.email = data.get('email') || '';
    form.reset();
    return stage === 'signup' ? 'verify' : 'workspace';
  }
  if (stage === 'verify') {
    if (data.get('code') !== '246810') {
      document.querySelector('#auth-error').textContent = 'Use 246810 for this preview.';
      form.elements.code.focus();
      return '';
    }
    return 'company';
  }
  if (stage === 'company') {
    account.company = data.get('company');
    return 'invite';
  }
  if (stage === 'invite') return 'ready';
  return 'reset-sent';
}
