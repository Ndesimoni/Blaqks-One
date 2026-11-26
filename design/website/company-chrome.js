import { companyBy } from './data.js';
import { esc, link, button, url } from './helpers.js';

export function companyWordmark(c, scope) {
  return `<a class="company-wordmark" href="${esc(url('home', {}, scope))}" aria-label="${esc(c.name)} home"><span class="company-seal" aria-hidden="true">${esc(c.mark)}</span><span>${esc(c.name)}<small>PROPERTY · ${esc(c.area.toUpperCase())}</small></span></a>`;
}
export function companyHeader(ctx) {
  const c = companyBy(ctx.scope.site),
    s = ctx.scope;
  const items = [
    ['properties', 'Properties'],
    ['developers', 'Developers'],
    ['about', 'Our approach'],
    ['agents', 'Our people'],
    ['contact', 'Contact'],
  ];
  return `<header class="header company-header">${companyWordmark(c, s)}<nav aria-label="Main navigation" id="nav">${items.map(([path, label]) => `<a href="${esc(url(path, {}, s))}"${ctx.page === path || (path === 'properties' && ctx.page === 'property') || (path === 'developers' && ctx.page === 'developer') || (path === 'agents' && ctx.page === 'agent') ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="header-meta">${button('Make an enquiry →', 'enquiry', { company: c.id }, s, true)}</div><button class="menu-button" data-action="menu" aria-expanded="false" aria-controls="nav" aria-label="Open menu">☰</button></header>`;
}
export function companyFooter(ctx) {
  const c = companyBy(ctx.scope.site),
    s = ctx.scope;
  return `<footer class="footer company-footer"><div class="company-footer-grid"><div>${companyWordmark(c, s)}<p>${esc(c.note)}<br>Discover a place that feels like your own.</p><small>Fictional company · Illustrative design preview</small></div><div><span class="eyebrow">EXPLORE</span>${link('Our properties', 'properties', {}, s)}${link('Developers', 'developers', {}, s)}${link('Our approach', 'about', {}, s)}${link('Our people', 'agents', {}, s)}</div><div><span class="eyebrow">START A CONVERSATION</span><p>${esc(c.area)}, United Arab Emirates</p>${link('Contact the company →', 'contact', {}, s)}<small>For a property, contact its named listing agent.</small></div></div><div class="footer-links"><span>© ${new Date().getFullYear()} ${esc(c.name)}</span>${link('Privacy', 'legal', { type: 'privacy' }, s)}${link('Terms', 'legal', { type: 'terms' }, s)}${link('Explore Blaqks One →', 'home')}${link('Design screen index', 'index')}</div></footer>`;
}
