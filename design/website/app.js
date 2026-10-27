import { home } from './home.js';
import { results } from './results.js';
import { directories, companyProfile, areaPages } from './directories.js';
import { propertyDetail, agentProfile } from './property.js';
import { information } from './information.js';
import { enquiry } from './enquiry.js';
import { system } from './states.js';
import { editor } from './editor.js';
import { platform } from './platform.js';
import { screenIndex } from './screen-index.js';
import { header, footer, reviewBar } from './chrome.js';
import { bindInteractions } from './interactions.js';
import { companyBy } from './data.js';
export const state = { draft: 'draft', saved: false, review: '', draftValues: {}, scroll: {} };
let previous = '';
export function context() {
  const [path, search = ''] = (location.hash.slice(1) || '/home').split('?');
  const query = new URLSearchParams(search);
  const theme = ['1', '2', '3', '4'].includes(query.get('theme')) ? query.get('theme') : '1';
  const site = query.get('site') || '';
  return {
    page: path.replace(/^\//, '') || 'home',
    query,
    theme,
    scope: site ? { site, theme } : {},
  };
}
function body(ctx) {
  if (ctx.scope.site && !companyBy(ctx.scope.site)) return system(ctx, 'site');
  const p = ctx.page;
  if (p === 'home') return home(ctx);
  if (p === 'properties') return results(ctx);
  if (['companies', 'agents'].includes(p)) return directories(ctx);
  if (p === 'company') return companyProfile(ctx);
  if (p === 'agent') return agentProfile(ctx);
  if (p === 'property') return propertyDetail(ctx);
  if (['areas', 'area'].includes(p)) return areaPages(ctx);
  if (['about', 'contact', 'business', 'plans', 'legal'].includes(p)) return information(ctx);
  if (p === 'enquiry') return enquiry(ctx);
  if (p === 'editor') return editor(ctx, state);
  if (p === 'platform') return platform(ctx, state);
  if (p === 'index') return screenIndex(ctx);
  return system(ctx);
}
export function render(restore = false) {
  const ctx = context();
  if (previous && !restore) state.scroll[previous] = window.scrollY;
  document.body.dataset.theme = ctx.scope.site ? ctx.theme : '1';
  document.body.classList.toggle('admin-preview', ['editor', 'platform'].includes(ctx.page));
  const content = body(ctx) || system(ctx, 'notfound');
  document.querySelector('#app').innerHTML =
    `${header(ctx)}<main id="main" tabindex="-1">${content}</main>${footer(ctx)}${reviewBar(ctx)}<dialog class="gallery-dialog" id="gallery"><button class="close-button" data-action="close-gallery" aria-label="Close gallery">×</button><img alt="Enlarged fictional property image"><p>Illustrative sample image · Not a live listing</p></dialog>`;
  document.title = `${ctx.page === 'index' ? 'All screens' : ctx.page[0].toUpperCase() + ctx.page.slice(1)} · Blaqks One design preview`;
  bindInteractions(ctx, state, render);
  requestAnimationFrame(() => window.scrollTo(0, restore ? state.scroll[location.hash] || 0 : 0));
  previous = location.hash;
}
window.addEventListener('hashchange', () => render(true));
window.addEventListener(
  'scroll',
  () => {
    if (previous === location.hash) state.scroll[previous] = window.scrollY;
  },
  { passive: true },
);
render();
