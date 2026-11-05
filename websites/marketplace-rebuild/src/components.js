import { images, price, saving, escapeHTML as esc } from './data.js';
import { ids } from './state.js';

export function header(active) {
  const links = [
    ['home', 'Home'], ['properties', 'Properties'], ['deals', 'Deals'],
    ['agents', 'Agents'], ['companies', 'Companies'], ['about', 'About'],
  ];
  return `<header class="site-header"><div class="wrap header-inner">
    <a class="brand" href="#home"><span class="brand-mark">▥</span>
      <span>BLAQKS ONE<small>EXCEPTIONAL REAL ESTATE</small></span></a>
    <button class="search-toggle" data-search aria-label="Open property search"
      aria-expanded="false" aria-controls="header-search">⌕</button>
    <nav aria-label="Main navigation">${links.map(([route, label]) =>
      `<a href="#${route}" ${active === route ? 'aria-current="page"' : ''}>${label}</a>`
    ).join('')}</nav>
    <details class="professional-menu"><summary>For Agents & Companies</summary>
      <div><a href="#signin">CRM sign in ↗</a><a href="#signup">Create an account</a>
      <a href="#professionals">Explore Blaqks One CRM</a>
      <a href="#saved">♡ Saved properties</a><a href="#recent">Recently viewed</a>
      <a href="#compare">Compare properties</a></div>
    </details></div>
    <form id="header-search" class="wrap header-search" hidden>
      <label for="header-query">Search properties</label>
      <div><span aria-hidden="true">⌕</span><input id="header-query" name="q"
        type="search" placeholder="Property or neighbourhood…"><button>Search →</button></div>
    </form></header>`;
}

export function footer() {
  return `<footer><div class="wrap footer-top"><div><p class="eyebrow">YOUR NEXT CHAPTER</p>
    <h2>Find a place.<br>Make a connection.</h2><a class="button gold" href="#properties">
    Explore properties ↗</a></div><div class="footer-links">
    <div><h3>Discover</h3><a href="#properties?purpose=Buy">Buy a property</a>
    <a href="#properties?purpose=Rent">Rent a home</a><a href="#deals">Property deals</a>
    <a href="#saved">Saved properties</a></div>
    <div><h3>For professionals</h3><a href="#agents">Agents</a>
    <a href="#companies">Companies</a><a href="#signin">CRM sign in</a>
    <a href="#signup">Create your workspace</a></div>
    <div><h3>Information</h3><a href="#about">About Blaqks One</a>
    <a href="#contact">Contact</a><a href="#help">Help & FAQs</a>
    <a href="#privacy">Privacy</a><a href="#terms">Terms</a></div></div></div>
    <div class="wrap footer-bottom">© 2026 Blaqks One · Reconstructed design concept.
    Properties, people, companies and deals are illustrative; verify all details before use.</div></footer>`;
}

export function propertyCard(p) {
  const saved = ids('saved').includes(p.id);
  return `<article class="property-card"><div class="card-photo">
    <a href="#property/${p.id}"><img src="${images[p.image]}" alt="${esc(p.title)}" loading="lazy"></a>
    <span class="badge">${p.purpose === 'Rent' ? 'FOR RENT' : 'FOR SALE'}</span>
    <button data-save="${p.id}" class="heart" aria-label="Save ${esc(p.title)}"
      aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></div>
    <div class="card-body"><span class="status">${p.status} · sample</span>
    <h3><a href="#property/${p.id}">${p.title}</a></h3><p class="muted">⌖ ${p.area}, Dubai</p>
    <div class="specs">${p.type === 'Office' ? 'Office' : p.beds ? p.beds + ' beds' : 'Studio'}
      <span>${p.baths} baths</span><span>${p.size.toLocaleString()} sq ft</span></div>
    <div class="card-price"><strong>${price(p)}</strong><a href="#property/${p.id}">Details ↗</a></div>
    <label class="compare-check"><input type="checkbox" data-compare="${p.id}"
      ${ids('compare').includes(p.id) ? 'checked' : ''}> Compare property</label></div></article>`;
}

export const cards = list => list.length ? list.map(propertyCard).join('') :
  '<div class="empty"><h2>No properties match.</h2><p>Try a wider search.</p><a href="#properties">Reset filters →</a></div>';

export function portrait(agent) {
  const initials = agent.name.split(' ').map(n => n[0]).join('');
  return `<div class="portrait" role="img" aria-label="Portrait placeholder for ${agent.name}">
    <span>${initials}</span><svg viewBox="0 0 140 150" aria-hidden="true">
    <circle cx="70" cy="45" r="24"/><path d="M22 145v-30a48 48 0 0 1 96 0v30"/></svg>
    <small>PHOTO TO BE ADDED</small></div>`;
}

export function dealCard(p) {
  return `<div class="deal-item">${propertyCard(p)}<div class="deal-summary">
    <span class="eyebrow">${p.deal} deal · SAMPLE</span>
    <p><del>${price({ ...p, price: p.reference })}</del> <strong>−${saving(p)}%</strong></p>
    <small>Compared with an illustrative reference price. Unverified.</small></div></div>`;
}

export function heading(kicker, title, description = '') {
  return `<section class="page-heading"><div class="wrap"><p class="eyebrow">${kicker}</p>
    <h1 id="page-title" tabindex="-1">${title}</h1><p>${description}</p></div></section>`;
}
