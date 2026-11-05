import { properties } from './data.js';
import { header, footer } from './components.js';
import { homePage } from './home.js';
import { listingsPage } from './listings.js';
import { propertyPage } from './property.js';
import { directoryPage, profilePage } from './people.js';
import { collectionPage } from './collections.js';
import { informationPage } from './information.js';
import { authPage, submitAccount, account } from './auth.js';
import { ids, write, toggleSaved, remember, compareSelection } from './state.js';
import { showDialog, closeDialog, enquiryDialog, whatsappDialog, galleryDialog } from './dialogs.js';

import { notify } from './notifications.js';

const app = document.querySelector('#app');
const authRoutes = new Set(['signup', 'signin', 'verify', 'company', 'invite', 'ready',
  'workspace', 'reset', 'reset-sent', 'expired']);
const locationParts = () => {
  const [route = 'home', query = ''] = location.hash.slice(1).split('?');
  return { route: route || 'home', params: new URLSearchParams(query) };
};

function render(preserveScroll = false) {
  const scrollY = window.scrollY;
  const { route, params } = locationParts();
  const [kind, id] = route.split('/');
  if (document.querySelector('#dialog').open) closeDialog();
  let body;
  if (route === 'home') body = homePage();
  else if (route === 'properties' || route === 'deals') {
    write('search', '#' + route + (params.size ? '?' + params.toString() : ''));
    body = listingsPage(params, route === 'deals');
  } else if (kind === 'property') {
    if (properties.some(p => p.id === Number(id))) remember(Number(id));
    body = propertyPage(id);
  } else if (route === 'agents' || route === 'companies') body = directoryPage(route, params);
  else if (kind === 'agent' || kind === 'company' && id) body = profilePage(kind, id);
  else if (['saved', 'recent', 'compare'].includes(route)) body = collectionPage(route);
  else if (authRoutes.has(route)) body = authPage(route);
  else body = informationPage(route);
  app.innerHTML = authRoutes.has(route) ? body : header(kind === 'property' ? 'properties' : route) + body + footer();
  document.querySelector('#comparison-tray')?.remove();
  const selected = ids('compare');
  if (selected.length && !authRoutes.has(route) && route !== 'compare') {
    const tray = document.createElement('aside');
    tray.id = 'comparison-tray';
    tray.innerHTML = `<span>${selected.length} of 3 properties selected</span><a href="#compare">Compare properties →</a>`;
    document.body.append(tray);
  }
  document.title = (document.querySelector('h1')?.textContent || 'Exceptional real estate') + ' — Blaqks One';
  window.scrollTo(0, preserveScroll ? scrollY : 0);
  if (!preserveScroll) document.querySelector('#page-title')?.focus({ preventScroll: true });
}

function navigateForm(form, route) {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) if (value.trim()) params.append(key, value);
  const hash = '#' + route + (params.size ? '?' + params.toString() : '');
  if (location.hash === hash) render();
  else location.hash = hash;
}

document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  if (form.matches('[data-preview-form]')) {
    notify('Preview complete. No message was sent or subscription created.');
    return;
  }
  if (form.id === 'auth-form') {
    const next = submitAccount(form);
    if (next) location.hash = next;
    return;
  }
  if (form.id === 'hero-search') {
    const min = Number(form.elements.min.value), max = Number(form.elements.max.value);
    if (max && min > max) return notify('Maximum price must be at least the minimum price.');
  }
  if (form.id === 'filters') {
    const min = Number(form.elements.min.value), max = Number(form.elements.max.value);
    if (max && min > max) return notify('Maximum price must be at least the minimum price.');
    if (Number(form.elements.sizeMax.value) && Number(form.elements.sizeMin.value) > Number(form.elements.sizeMax.value)) {
      return notify('Maximum area must be at least the minimum area.');
    }
  }
  navigateForm(form, form.dataset.route || 'properties');
});

document.addEventListener('change', event => {
  const target = event.target;
  if (target.matches('[data-compare]')) {
    const message = compareSelection(Number(target.dataset.compare), properties);
    if (message) notify(message);
    render(true);
  }
  if (target.matches('#filters [name="purpose"]')) {
    const form = target.form;
    for (const name of ['min', 'max']) {
      form.elements[name].value = '';
      form.elements[name].disabled = !target.value;
    }
    navigateForm(form, form.dataset.route);
  }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('.close')) return closeDialog();
  if (button.hasAttribute('data-save')) {
    toggleSaved(Number(button.dataset.save));
    render(true);
  } else if (button.hasAttribute('data-compare')) {
    const message = compareSelection(Number(button.dataset.compare), properties);
    if (message) notify(message);
    render();
  } else if (button.hasAttribute('data-search')) {
    const panel = document.querySelector('#header-search');
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', !panel.hidden);
    if (!panel.hidden) document.querySelector('#header-query').focus();
  } else if (button.dataset.enquiry) enquiryDialog(button.dataset.enquiry, button.dataset.request);
  else if (button.dataset.whatsapp) whatsappDialog(button.dataset.whatsapp);
  else if (button.dataset.gallery) galleryDialog(button.dataset.gallery);
  else if (button.hasAttribute('data-share') || button.hasAttribute('data-copy-message')) {
    const text = button.hasAttribute('data-share') ? location.href : document.querySelector('#whatsapp-message').value;
    try { await navigator.clipboard.writeText(text); notify('Copied.'); }
    catch { notify('Copy is unavailable. Select and copy the message or page address manually.'); }
  } else if (button.hasAttribute('data-password')) {
    const input = document.querySelector('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Show' : 'Hide';
    button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  } else if (button.dataset.provider) {
    showDialog(`<h2 id="dialog-title">Continue with ${button.dataset.provider}.</h2>
      <p>Social sign-in design preview. No provider is contacted.</p>
      <button class="button navy" data-provider-confirm>Continue with sample identity →</button>`);
  } else if (button.hasAttribute('data-provider-confirm')) {
    account.name = 'Alex Jordan'; account.email = 'alex.jordan@example.com';
    closeDialog(); location.hash = 'company';
  } else if (button.hasAttribute('data-resend')) notify('Preview code: 246810. No email was sent.');
});
document.querySelector('#dialog').addEventListener('click', e => {
  if (e.target.id === 'dialog') closeDialog();
});
window.addEventListener('hashchange', () => render());
render();
