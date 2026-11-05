import { agents, companies, properties, companyFor, escapeHTML as esc } from './data.js';
import { portrait, cards, heading } from './components.js';
import { featuredAgents } from './home.js';

function agentCard(a) {
  return `<article class="agent-row">${portrait(a)}<div><p class="eyebrow">PROPERTY ADVISOR</p>
    <h2>${a.name}</h2><a href="#company/${a.company}">${companyFor(a).name} ↗</a>
    <p>${a.focus}</p><p class="muted">⌖ ${a.area}, Dubai</p></div>
    <a class="button navy" href="#agent/${a.id}">View agent profile ↗</a></article>`;
}

export function directoryPage(kind, params) {
  const query = (params.get('q') || '').toLowerCase();
  const isAgent = kind === 'agents';
  const items = (isAgent ? agents : companies).filter(x =>
    (x.name + ' ' + x.focus + ' ' + (x.area || '')).toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(items.length / 5));
  const page = Math.min(totalPages, Math.max(1, Number(params.get('page')) || 1));
  const visible = items.slice((page - 1) * 5, page * 5);
  const link = n => '#' + kind + '?' + new URLSearchParams({ q: query, page: n });
  return `<main id="main">${heading('FIND YOUR PROPERTY PARTNER',
    isAgent ? 'The right people.<br>A more personal search.' : 'Companies behind the collection.',
    'Illustrative professional profiles for the Blaqks One marketplace.')}
    <section class="wrap section"><form id="directory-search" data-route="${kind}" class="directory-search">
    <label>Search ${kind}<input name="q" type="search" placeholder="Name, speciality or area"
      value="${esc(params.get('q') || '')}"></label><button class="button navy">Search</button></form>
    <p role="status">${items.length} sample ${kind}</p><div class="directory">
    ${visible.length ? visible.map(x => isAgent ? agentCard(x) : `<article class="company-card">
      <span class="company-monogram">${x.name[0]}</span><div><p class="eyebrow">REAL ESTATE COMPANY</p>
      <h2>${x.name}</h2><p>${x.focus}</p><a href="#company/${x.id}">Explore company ↗</a></div></article>`).join('') :
      '<div class="empty">No profiles match this search.</div>'}</div>
    <nav class="pagination" aria-label="Directory pages">
      ${page > 1 ? `<a href="${link(page - 1)}">← Previous</a>` : ''}
      ${Array.from({ length: totalPages }, (_, i) => `<a href="${link(i + 1)}"
        ${page === i + 1 ? 'aria-current="page"' : ''}>${i + 1}</a>`).join('')}
      ${page < totalPages ? `<a href="${link(page + 1)}">Next →</a>` : ''}
    </nav></section></main>`;
}

export function profilePage(kind, id) {
  const agent = kind === 'agent';
  const item = (agent ? agents : companies).find(x => x.id === Number(id));
  if (!item) return '<main id="main" class="wrap section"><h1>Profile not found.</h1></main>';
  const listings = properties.filter(p => agent ? p.agent === item.id : p.company === item.id);
  return `<main id="main">${heading(agent ? 'MEET YOUR PROPERTY PARTNER' : 'COMPANY PROFILE', item.name, item.focus)}
    <section class="wrap section profile-intro">${agent ? portrait(item) :
      `<div class="company-monogram">${item.name[0]}</div>`}<div><h2>A more personal connection.</h2>
      <p>${agent ? item.name + ' · ' + companyFor(item).name : item.name}</p>
      <p>Sample professional profile. Biography, credentials and contact details must be supplied and verified.</p>
      <a class="button navy" href="#contact">Contact information →</a></div></section>
    <section class="wrap section"><h2>${agent ? 'Agent' : 'Company'} properties.</h2>
      <div class="property-grid">${cards(listings)}</div></section>
    ${agent ? featuredAgents() : `<section class="wrap section"><h2>Meet the team.</h2>
      <div class="directory">${agents.filter(a => a.company === item.id).map(agentCard).join('')}</div></section>`}
    </main>`;
}
