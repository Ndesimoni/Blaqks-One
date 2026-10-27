import { companies, agents, properties, areas, companyBy } from './data.js';
import { heading, link, button, grid, agentCard, esc, avatar, listingCount } from './helpers.js';
export function directories(ctx) {
  const mode = ctx.page,
    s = ctx.scope,
    needle = (ctx.query.get('q') || '').toLowerCase();
  const isCompany = mode === 'companies';
  const items = (
    isCompany ? companies : agents.filter((a) => !s.site || a.company === s.site)
  ).filter((v) => v.name.toLowerCase().includes(needle));
  return `<section class="section page-top">${heading('PEOPLE BEHIND YOUR NEXT MOVE', isCompany ? 'Find your property company.' : 'Meet your property people.', 'Explore public profiles and the properties they represent. No performance statistics.')}<form class="directory-search" data-form="directory"><input type="hidden" name="destination" value="${mode}"><input type="hidden" name="site" value="${esc(s.site || '')}"><input type="hidden" name="theme" value="${esc(s.theme || '')}"><label class="grow">${isCompany ? 'Company' : 'Agent'} name<input name="q" value="${esc(ctx.query.get('q') || '')}" placeholder="Search ${mode}"></label><button class="button" type="submit">Search →</button></form><p class="muted">${items.length} ${mode} · Counts include only this preview's public listings.</p><div class="${isCompany ? 'company-grid' : 'people-grid'}">${items.map((v) => (isCompany ? companyCard(v) : agentCard(v, s))).join('')}</div>${!items.length ? '<div class="empty"><h2>No matching profiles</h2><p>Try another name.</p></div>' : ''}</section>`;
}
function companyCard(c) {
  const count = agents.filter((a) => a.company === c.id && listingCount(null, a.id) > 0).length;
  return `<article class="company-card"><div class="company-cover" style="background-image:url('${properties.find((p) => p.company === c.id).image}')"></div><div class="card-content"><span class="company-mark">${c.mark}</span><h2>${esc(c.name)}</h2><p class="muted">${esc(c.note)}</p><div class="public-totals"><span><strong>${listingCount(c.id)}</strong> public listings</span><span><strong>${count}</strong> agents with listings</span></div><div class="actions">${button('View company →', 'company', { id: c.id })}${button('Properties', 'properties', { company: c.id }, {}, true)}</div></div></article>`;
}
export function companyProfile(ctx) {
  const c = companyBy(ctx.query.get('id') || ctx.scope.site),
    s = ctx.scope;
  if (!c || (s.site && s.site !== c.id)) return null;
  const tab = ctx.query.get('tab') || 'properties';
  const team = agents.filter((a) => a.company === c.id);
  const content =
    tab === 'agents'
      ? `<div class="people-grid">${team.map((a) => agentCard(a, s)).join('')}</div>`
      : tab === 'about'
        ? `<div class="prose"><h2>Property, with a personal perspective.</h2><p>${esc(c.note)} This fictional company profile demonstrates approved business information, service areas and professional identity.</p><p>Credentials and public contact details will appear only when specifically approved.</p></div>`
        : tab === 'contact'
          ? `<div class="prose"><h2>Start with a conversation.</h2><p>General enquiries are addressed to ${esc(c.name)}. For a particular property, contact its named listing agent.</p>${button('Enquire with the company', 'enquiry', { company: c.id }, s)}</div>`
          : grid(
              properties.filter((p) => p.company === c.id),
              s,
            );
  return `<section class="section page-top"><p class="breadcrumb">${link('Companies', 'companies')} / ${esc(c.name)}</p><div class="profile-heading"><span class="company-mark large">${c.mark}</span><div>${heading(c.area, c.name, c.note)}</div><div class="profile-totals"><strong>${listingCount(c.id)}</strong><span>public listings</span><strong>${team.length}</strong><span>agents with listings</span></div></div><nav class="tabs" aria-label="Company profile">${['properties', 'agents', 'about', 'contact'].map((t) => link(t[0].toUpperCase() + t.slice(1), 'company', { id: c.id, tab: t }, s, tab === t ? 'active' : '')).join('')}</nav><div class="profile-content">${content}</div></section>`;
}
export function areaPages(ctx) {
  const s = ctx.scope,
    area = areas.find((a) => a.id === ctx.query.get('id'));
  if (ctx.page === 'area' && !area) return null;
  if (area)
    return `<section class="section page-top">${heading('EXPLORE THE NEIGHBOURHOOD', area.name, area.note)}<img class="area-banner" src="${area.image}" alt="Illustrative area image"><div class="section-heading"><h2>Find your place here.</h2>${link('Refine this search →', 'properties', { area: area.id }, s)}</div>${grid(
      properties.filter((p) => p.area === area.id && (!s.site || p.company === s.site)),
      s,
    )}</section>`;
  return `<section class="section page-top">${heading('A SENSE OF PLACE', 'Where will your next chapter begin?', 'Explore locations and the public properties available in each.')}<div class="area-grid">${areas.map((a) => link(`<img src="${a.image}" alt="Illustrative property image"><span><h2>${a.name}</h2><p>${a.note}</p></span>`, 'area', { id: a.id }, s, 'area-card')).join('')}</div></section>`;
}
