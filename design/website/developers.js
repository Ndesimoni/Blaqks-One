import { developers, developerBy, developerBases } from './developer-data.js';
import { developerStock, matchingDevelopers, developerSampleNotice } from './developer-model.js';
import { companyBy } from './data.js';
import { heading, esc, link, button, select, grid, notice } from './helpers.js';

function developerCard(developer, scope) {
  const count = developerStock(developer.id, scope).length;
  return `<article class="developer-card"><span class="eyebrow">${esc(developer.base)}</span><h3>${link(esc(developer.name), 'developer', { id: developer.id }, scope)}</h3><p>${count} sample ${count === 1 ? 'listing' : 'listings'}${scope.site ? ' with this company' : ''}</p>${link(`Explore developer <span aria-hidden="true">→</span><span class="sr-only"> ${esc(developer.name)}</span>`, 'developer', { id: developer.id }, scope, 'developer-card-link')}</article>`;
}
export function developerSection(scope = {}) {
  return `<section class="section developer-section" aria-labelledby="developer-section-title"><div class="section-heading"><div><span class="eyebrow">DEVELOPERS ACROSS THE UAE</span><h2 id="developer-section-title">The names behind<br>the places.</h2></div>${link(`Explore all ${developers.length} developers →`, 'developers', {}, scope)}</div><div class="developer-grid">${developers
    .slice(0, 6)
    .map((developer) => developerCard(developer, scope))
    .join('')}</div><p class="developer-sample-note">${developerSampleNotice}</p></section>`;
}
export function developerDirectory(ctx) {
  const s = ctx.scope,
    q = ctx.query;
  const matches = matchingDevelopers(q, s);
  const pages = Math.ceil(matches.length / 12);
  const current = Math.max(1, Math.min(Number(q.get('page')) || 1, pages || 1));
  const params = Object.fromEntries(q);
  return `<section class="section page-top developer-directory">${heading('THE PEOPLE SHAPING PLACES', 'Explore UAE developers.', 'Discover selected developer names and browse their properties in this website’s collection.')}<form class="developer-search" data-form="directory"><input type="hidden" name="destination" value="developers"><input type="hidden" name="site" value="${esc(s.site || '')}"><input type="hidden" name="theme" value="${esc(s.theme || '')}"><label>Developer name<input name="q" value="${esc(q.get('q') || '')}" placeholder="Emaar, Azizi, Sobha…"></label>${select('Base emirate', 'base', [['', 'All base emirates'], ...developerBases.map((base) => [base, base])], q.get('base') || '')}${select(
    'Property availability',
    'availability',
    [
      ['', 'All selected developers'],
      ['listed', 'With sample properties here'],
    ],
    q.get('availability') || '',
  )}<button type="submit" class="button">Search developers →</button></form><div class="developer-directory-meta"><p>${matches.length} matching developers · ${developers.length} in this selected directory</p>${link('Clear filters', 'developers', {}, s)}</div>${notice(developerSampleNotice)}${
    matches.length
      ? `<div class="developer-grid">${matches
          .slice((current - 1) * 12, current * 12)
          .map((developer) => developerCard(developer, s))
          .join('')}</div>`
      : `<div class="empty"><h2>No matching developers.</h2><p>Try a different name, base emirate or property availability.</p>${button('Clear filters', 'developers', {}, s)}</div>`
  }<nav class="pagination" aria-label="Developer directory pages">${Array.from({ length: pages }, (_, index) => link(String(index + 1), 'developers', { ...params, page: String(index + 1) }, s, `page-number${current === index + 1 ? ' active' : ''}`)).join('')}</nav></section>`;
}
export function developerProfile(ctx) {
  const developer = developerBy(ctx.query.get('id')),
    s = ctx.scope;
  if (!developer) return null;
  const stock = developerStock(developer.id, s),
    company = companyBy(s.site);
  const source = developer.website
    ? `<a class="editorial-link" href="${esc(developer.website)}" target="_blank" rel="noopener noreferrer">Developer website →<span class="sr-only"> ${esc(developer.name)} (opens a new tab)</span></a>`
    : '';
  return `<section class="section page-top developer-profile"><p class="breadcrumb">${link('Developers', 'developers', {}, s)} / ${esc(developer.name)}</p><div class="developer-profile-heading"><div>${heading('UAE DEVELOPER DIRECTORY', esc(developer.name), `Base: ${esc(developer.base)} · United Arab Emirates`)}${source}</div><div class="developer-profile-summary"><strong>${stock.length}</strong><span>sample listings${company ? ` with ${esc(company.name)}` : ' on this website'}</span>${button('Browse developer properties →', 'properties', { developer: developer.id }, s, true)}</div></div>${notice(developerSampleNotice)}<div class="section-heading"><div><span class="eyebrow">THE PROPERTY COLLECTION</span><h2>Explore properties<br>by ${esc(developer.name)}.</h2></div>${stock.length ? link('Refine these properties →', 'properties', { developer: developer.id }, s) : ''}</div>${stock.length ? grid(stock, s) : `<div class="empty"><h2>No properties in this collection yet.</h2><p>No sample properties from ${esc(developer.name)}${company ? ` with ${esc(company.name)}` : ' on this website'}. Browse the current collection or contact ${company ? 'this company' : 'the listing company on a property'} about your requirements.</p><div class="actions">${button('View all properties', 'properties', {}, s)}${company ? button('Contact the company', 'enquiry', { company: company.id }, s, true) : button('Back to developers', 'developers', {}, s, true)}</div></div>`}</section>`;
}
