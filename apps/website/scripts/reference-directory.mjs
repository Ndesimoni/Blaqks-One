import { icon } from './icons.js';

export const safe = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const titleCase = (value) =>
  String(value ?? '')
    .replaceAll('-', ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
export const monogram = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
const field = (kind) => (kind === 'areas' ? 'area' : 'developer');
export const listingsFor = (data, kind, id) =>
  data.catalogue.listings.filter((listing) => listing[field(kind)] === id);
export const countFor = (data, kind, item) =>
  item.publicListingCount ?? listingsFor(data, kind, item.id).length;
export const propertyCount = (data, count) =>
  `${count} ${data.site.sample ? 'sample' : 'published'} ${count === 1 ? 'property' : 'properties'}`;
export const placeLabel = (kind, item) =>
  kind === 'areas'
    ? `COMMUNITY · ${titleCase(item.city || item.emirate).toUpperCase()}`
    : `DEVELOPER · ${titleCase(item.emirate).toUpperCase()}`;

function placeCard(data, kind, item) {
  const href = `/${kind}/${encodeURIComponent(item.id)}`;
  const image =
    kind === 'areas' && (listingsFor(data, kind, item.id)[0]?.image || item.image || '');
  const media = image
    ? `<img src="${safe(image)}" alt="" loading="lazy">`
    : `<span class="u-place-monogram">${safe(monogram(item.name))}</span>`;
  return `<article class="u-company-card u-place-card"><a href="${href}" class="u-company-photo${
    image ? '' : ' u-place-tile'
  }" tabindex="-1" aria-hidden="true">${media}</a><div class="u-card-content">
    <p class="e-kicker">${safe(placeLabel(kind, item))}</p><h3>${safe(item.name)}</h3>
    <p>${propertyCount(data, countFor(data, kind, item))}</p><a class="u-card-link" href="${href}">
    Explore ${kind === 'areas' ? 'community' : 'developer'} →</a></div></article>`;
}

function pageLink(data, page, label, current) {
  const params = new URLSearchParams();
  if (typeof data.query.q === 'string' && data.query.q) params.set('q', data.query.q);
  if (page > 1) params.set('page', String(page));
  const href = `/${data.page}${params.size ? '?' + params : ''}`;
  if (current) return `<span class="u-page-link" aria-current="page">${label}</span>`;
  return `<a class="u-page-link" href="${href}">${label}</a>`;
}

function pagination(data, total, page, pageSize, noun) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return '';
  const numbers =
    pages <= 7
      ? Array.from({ length: pages }, (_, i) => pageLink(data, i + 1, i + 1, i + 1 === page))
      : [pageLink(data, page, page, true)];
  const edge = (target, label) =>
    target < 1 || target > pages
      ? `<span class="u-page-link" aria-disabled="true">${label}</span>`
      : pageLink(data, target, label, false);
  return `<nav class="u-agent-pagination u-place-pagination" aria-label="${noun} pages">
    <span>Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} ${noun}</span>
    <div>${edge(page - 1, '← Previous')}${numbers.join('')}${edge(page + 1, 'Next →')}</div></nav>`;
}

export function directoryContent(data) {
  const kind = data.page;
  const area = kind === 'areas';
  const list = data.catalogue[kind];
  const { total = list.length, page = 1, pageSize = 12 } = data.directory || {};
  const noun = area ? ['community', 'communities'] : ['developer', 'developers'];
  const query = typeof data.query.q === 'string' ? data.query.q : '';
  const toolbar = `<div class="u-directory-toolbar"><label class="u-directory-search">${icon('search')}
    <input type="search" id="u-place-search" value="${safe(query)}" aria-label="Search ${noun[1]}"
    placeholder="Search ${noun[1]} by name…"></label><span role="status">${total} ${
      total === 1 ? noun[0] : noun[1]
    }</span></div>`;
  const grid = list.length
    ? `<div class="u-directory-grid u-place-grid">${list.map((item) => placeCard(data, kind, item)).join('')}</div>`
    : `<div class="l-empty"><h3>No matching ${noun[1]}.</h3><p>Try another name or clear the search.</p>
      <a class="e-text" href="/${kind}">Show all ${noun[1]} →</a></div>`;
  const note = data.site.sample
    ? `<p class="u-note">${
        area
          ? 'Communities from the design collection · property counts are illustrative.'
          : 'Reference names only · property associations are illustrative, not partnerships.'
      }</p>`
    : '';
  return toolbar + grid + pagination(data, total, page, pageSize, noun[1]) + note;
}
