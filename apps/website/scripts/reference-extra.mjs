import { siteHeader } from './site-header.js';
import { professionalFooter } from './property-extras.js';
import { homes, cards } from './estate.js';

const safe = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function extraPage() {
  const data = window.__blaqksReference;
  const page = data.page;
  const legal = ['privacy', 'terms'].includes(page);
  const area = ['areas', 'area'].includes(page);
  const resource = area ? 'areas' : 'developers';
  const entity = data.entity;
  const title = legal
    ? page === 'privacy'
      ? 'Privacy notice.'
      : 'Website terms.'
    : entity?.name || (area ? 'Find your sense of place.' : 'The people shaping the UAE.');
  const list = data.catalogue[resource];
  const content = legal
    ? `<div class="u-contact-panel"><h2>Policy content is being prepared.</h2>
    <p>This content is not a final legal policy. The company must supply its reviewed policy before public launch.</p></div>`
    : entity
      ? `<div class="e-grid">${cards(homes)}</div>`
      : `<div class="u-grid">${
          list
            .map(
              (item) => `<article class="u-company-card"><div class="u-card-content">
      <p class="e-kicker">${area ? 'THE NEIGHBOURHOOD' : 'UAE DEVELOPER'}</p><h2>${safe(item.name)}</h2>
      <p>${safe(item.note || item.emirate || '')}</p><a class="u-card-link" href="#${resource}/${encodeURIComponent(item.id)}">
      Explore ${area ? 'community' : 'developer'} →</a></div></article>`,
            )
            .join('') || '<p class="u-note">No public profiles are currently available.</p>'
        }</div>`;
  return `<div class="estate public-page">${siteHeader(page)}<main id="main"><section class="u-intro"><div class="e-wrap">
    <nav class="p-breadcrumb"><a href="#home">Home</a><span>›</span><span>${safe(title)}</span></nav>
    <p class="e-kicker">PROPERTY & PEOPLE</p><h1 id="page-title" tabindex="-1">${safe(title)}</h1>
    <p class="u-intro-copy">${legal ? 'Website information.' : 'Explore the properties and people behind your next chapter.'}</p>
    </div></section><section class="e-wrap u-directory">${content}</section></main>${professionalFooter()}</div>`;
}
