import { companyBy, themeNames } from './data.js';
import { link, esc } from './helpers.js';
import { companyHeader, companyFooter } from './company-chrome.js';
const mark =
  '<svg width="24" height="34" viewBox="0 0 24 34" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M3 31V8l9-6 9 6v23l-9 2-9-2ZM8 31V7m8 24V7M12 2v31"/></svg>';
export function header(ctx) {
  if (companyBy(ctx.scope.site) && !['editor', 'platform'].includes(ctx.page))
    return companyHeader(ctx);
  if (['editor', 'platform'].includes(ctx.page))
    return `<header class="header admin-header"><a class="brand" href="#/index"><span class="brand-mark">${mark}</span>BLAQKS ONE</a><span class="muted">${ctx.page === 'editor' ? 'Company website workspace' : 'Platform website administration'} · Design preview</span>${link('Screen directory →', 'index')}</header>`;
  const c = companyBy(ctx.scope.site),
    s = ctx.scope;
  const nav = c
    ? [
        link('Properties', 'properties', {}, s),
        link('About us', 'about', {}, s),
        link('Our team', 'agents', {}, s),
        link('Contact', 'contact', {}, s),
      ]
    : [
        link('Buy', 'properties', { purpose: 'buy' }),
        link('Rent', 'properties', { purpose: 'rent' }),
        link('Holiday homes', 'properties', { purpose: 'holiday' }),
        link('Developers', 'developers'),
        link('Companies', 'companies'),
        link('Agents', 'agents'),
        link('Areas', 'areas'),
      ];
  return `<header class="header"><a class="brand" href="${c ? `#/home?site=${c.id}&theme=${ctx.theme}` : '#/home'}"><span class="brand-mark">${mark}</span>${esc(c?.name || 'BLAQKS ONE')}</a>
    <nav aria-label="Main navigation" id="nav">${nav.join('')}</nav>
    <div class="header-meta">${link(c ? 'Blaqks One' : 'For professionals', c ? 'home' : 'business')}${!c ? link('CRM sign in →', 'system', { state: 'signin' }) : ''}</div>
    <button class="menu-button" data-action="menu" aria-expanded="false" aria-controls="nav" aria-label="Open menu">☰</button></header>`;
}
export function footer(ctx) {
  if (companyBy(ctx.scope.site) && !['editor', 'platform'].includes(ctx.page))
    return companyFooter(ctx);
  if (['editor', 'platform'].includes(ctx.page))
    return '<footer class="admin-footer">Blaqks One design workspace · All actions are demonstrations; no live services connected.</footer>';
  const s = ctx.scope,
    c = companyBy(s.site);
  return `<footer class="footer"><div class="footer-top"><div><span class="eyebrow">A BETTER PLACE TO BEGIN</span><h2>${c ? 'Your next chapter starts here.' : 'Find a place that feels like you.'}</h2>${link('Explore properties →', 'properties', {}, s)}</div><div><strong>${esc(c?.name || 'BLAQKS ONE')}</strong><p>UAE property discovery.<br>Considered from the first search.</p></div></div><div class="footer-links">${link('Developers', 'developers', {}, s)}${link('About', 'about', {}, s)}${link('Contact', 'contact', {}, s)}${link('Privacy', 'legal', { type: 'privacy' }, s)}${link('Terms', 'legal', { type: 'terms' }, s)}${link('Design screen index', 'index')}<span>Design prototype · Fictional sample content</span></div></footer>`;
}
export function reviewBar(ctx) {
  const themes = ctx.scope.site
    ? `<label class="review-theme"><span class="sr-only">Company theme</span><select data-action="company-theme">${themeNames.map((name, i) => `<option value="${i + 1}"${ctx.theme === String(i + 1) ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`
    : '';
  return `<aside class="review-bar" aria-label="Design preview controls"><span class="preview-dot"></span><strong>DESIGN PREVIEW</strong>${link('All screens', 'index')}${link('General site', 'home')}${link('Company site', 'home', { site: 'harbour', theme: ctx.theme })}${link('Website editor', 'editor')}${link('Platform', 'platform')}${themes}<span class="review-note">Sample data · No live services</span></aside>`;
}
