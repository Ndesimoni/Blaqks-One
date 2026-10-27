import { companies, companyBy, areaBy, agentBy, properties } from './data.js';
export const esc = (v = '') =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const money = (p) =>
  `AED ${p.price.toLocaleString('en-AE')}${p.purpose === 'rent' ? ' / year' : p.purpose === 'holiday' ? ' / night' : ''}`;
export function url(path, params = {}, scope = {}) {
  const query = new URLSearchParams({ ...scope, ...params });
  return `#/${path}${query.size ? `?${query}` : ''}`;
}
export const link = (label, path, params = {}, scope = {}, cls = '') =>
  `<a class="${cls}" href="${esc(url(path, params, scope))}">${label}</a>`;
export const button = (label, path, params = {}, scope = {}, quiet = false) =>
  link(label, path, params, scope, `button${quiet ? ' quiet' : ''}`);
export const initial = (name) =>
  name
    .split(' ')
    .map((v) => v[0])
    .slice(0, 2)
    .join('');
export const avatar = (name, big = false) =>
  `<span class="avatar${big ? ' big' : ''}" aria-hidden="true">${esc(initial(name))}</span>`;
export const heading = (eyebrow, title, text = '') =>
  `<div class="page-heading"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${text ? `<p class="muted">${text}</p>` : ''}</div>`;
export const notice = (text) => `<p class="notice">${text}</p>`;
export function select(label, name, options, current = '') {
  return `<label>${label}<select name="${name}">${options.map(([value, text]) => `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
}
export const companyOptions = () => [
  ['', 'All companies'],
  ...companies.map((c) => [c.id, c.name]),
];
export const listingCount = (company, agent) =>
  properties.filter((p) => (!company || p.company === company) && (!agent || p.agent === agent))
    .length;
export function propertyCard(p, scope = {}) {
  const agent = agentBy(p.agent),
    company = companyBy(p.company),
    area = areaBy(p.area);
  return `<article class="property-card">
    ${link(`<img src="${p.image}" alt="Fictional ${esc(p.type.toLowerCase())} design sample" loading="lazy" width="1200" height="800"><span class="photo-label">${p.purpose === 'buy' ? 'FOR SALE' : p.purpose === 'rent' ? 'FOR RENT' : 'HOLIDAY HOME'}</span>`, 'property', { id: p.id }, scope, 'property-image')}
    <div class="card-content"><strong class="price">${money(p)}</strong>
      ${link(`<h3>${esc(p.title)}</h3>`, 'property', { id: p.id }, scope)}
      <p class="muted">${esc(area.name)}, ${esc(area.city)}</p>
      <div class="facts"><span>${p.bedrooms ? `${p.bedrooms} beds` : 'Office'}</span><span>${p.bathrooms} baths</span><span>${p.size.toLocaleString()} sqft</span></div>
      <div class="card-person">${avatar(agent.name)}<span>${link(esc(agent.name), 'agent', { id: agent.id }, scope)}<small>${link(esc(company.name), 'company', { id: company.id }, scope)}</small></span><span class="arrow">→</span></div>
    </div></article>`;
}
export const grid = (items, scope = {}, cls = '') =>
  `<div class="property-grid ${cls}">${items.map((p) => propertyCard(p, scope)).join('')}</div>`;
export function agentCard(a, scope = {}) {
  return `<article class="person-card">${avatar(a.name, true)}<h3>${esc(a.name)}</h3><p>${esc(a.specialty)}</p><p class="muted">${esc(companyBy(a.company).name)}</p><p class="public-count">${listingCount(null, a.id)} public listings</p>${button('View profile →', 'agent', { id: a.id }, scope, true)}</article>`;
}
