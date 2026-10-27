import { propertyBy, agentBy, companyBy, areaBy, properties, images } from './data.js';
import { esc, heading, grid, link, button, money, avatar } from './helpers.js';
export function propertyDetail(ctx) {
  const p = propertyBy(ctx.query.get('id')),
    s = ctx.scope;
  if (!p || (s.site && p.company !== s.site)) return null;
  const a = agentBy(p.agent),
    c = companyBy(p.company),
    area = areaBy(p.area);
  const params = { listing: p.id };
  return `<section class="section page-top"><p class="breadcrumb"><button class="text-button" data-action="back">← Back</button> / ${link('All properties', 'properties', {}, s)} / ${esc(area.name)}</p>
    <div class="detail-gallery"><button data-action="gallery" data-image="${p.image}" aria-label="Open property gallery"><img src="${p.image}" alt="Fictional ${esc(p.type.toLowerCase())} gallery image" width="1200" height="800"></button><div><button data-action="gallery" data-image="${images.apartment}" aria-label="Open interior sample"><img src="${images.apartment}" alt="Interior design sample"></button><button data-action="gallery" data-image="${images.villa}" aria-label="Open exterior sample"><img src="${images.villa}" alt="Exterior design sample"></button></div><span class="sample-tag">Illustrative sample photography</span></div>
    <div class="detail-layout"><div><span class="eyebrow">${p.purpose === 'buy' ? 'FOR SALE' : p.purpose === 'rent' ? 'FOR RENT' : 'HOLIDAY HOME'} · ${p.ready === 'ready' ? 'READY' : 'OFF-PLAN'}</span><h1 class="detail-title">${esc(p.title)}</h1><p class="muted">${esc(area.name)}, ${esc(area.city)}</p><strong class="detail-price">${money(p)}</strong><div class="detail-facts"><span><b>${p.bedrooms || '—'}</b>${p.bedrooms ? 'Bedrooms' : 'Office space'}</span><span><b>${p.bathrooms}</b>Bathrooms</span><span><b>${p.size.toLocaleString()}</b>sqft</span></div>
      <nav class="anchor-nav" aria-label="Property sections"><a href="#overview" data-anchor="overview">Overview</a><a href="#features" data-anchor="features">Features</a><a href="#location" data-anchor="location">Location</a><a href="#details" data-anchor="details">Listing details</a></nav>
      <section class="prose" id="overview"><h2>Space for your next chapter.</h2><p>A considered layout, comfortable living spaces and a setting to make your own. This fictional listing demonstrates the public property presentation and enquiry journey.</p><p>Actual descriptions, images and representative details will be approved before publication.</p></section>
      <section class="detail-section" id="features"><h2>The details that make a home.</h2><div class="amenities"><span>Open living spaces</span><span>Natural light</span><span>Covered parking</span><span>Outdoor space</span></div><h3>Floor plans</h3><p class="muted">No floor plan is supplied for this design sample.</p></section>
      <section class="detail-section" id="location"><h2>A sense of place.</h2><div class="location-placeholder"><span>⌖</span><strong>${esc(area.name)}</strong><p>Area-level location · Exact unit and access details are private.</p></div></section>
      <section class="detail-section" id="details"><h2>Listing information</h2><dl class="key-values"><div><dt>Representative</dt><dd>${link(esc(a.name), 'agent', { id: a.id }, s)}</dd></div><div><dt>Company</dt><dd>${link(esc(c.name), 'company', { id: c.id }, s)}</dd></div><div><dt>Advertising permit</dt><dd>Design placeholder · Not an approved live listing</dd></div><div><dt>Public reference</dt><dd>PREVIEW-${p.id.padStart(3, '0')}</dd></div></dl></section></div>
      <aside class="enquiry-panel">${avatar(a.name, true)}<span class="eyebrow">YOUR LISTING REPRESENTATIVE</span><h2>${esc(a.name)}</h2><p>${link(esc(c.name), 'company', { id: c.id }, s)}</p><p class="muted">Ask about this property. Your enquiry belongs to the company representing it.</p>${button('Enquire about this property →', 'enquiry', params, s)}${button('View agent profile', 'agent', { id: a.id }, s, true)}<small>Contact links and delivery are intentionally disabled in this prototype.</small></aside></div>
    <div class="section-heading"><h2>More places to consider.</h2>${link('Explore properties →', 'properties', {}, s)}</div>${grid(properties.filter((v) => v.id !== p.id && v.purpose === p.purpose && (!s.site || v.company === s.site)).slice(0, 3), s)}
    <div class="mobile-enquiry">${button('Enquire about this property →', 'enquiry', params, s)}</div></section>`;
}
export function agentProfile(ctx) {
  const a = agentBy(ctx.query.get('id')),
    s = ctx.scope;
  if (!a || (s.site && a.company !== s.site)) return null;
  const c = companyBy(a.company),
    stock = properties.filter((p) => p.agent === a.id);
  return `<section class="section page-top"><p class="breadcrumb">${link('Agents', 'agents', {}, s)} / ${esc(a.name)}</p><div class="agent-profile"><div>${avatar(a.name, true)}<span class="eyebrow">${esc(a.specialty)}</span><h1>${esc(a.name)}</h1><p>${link(esc(c.name), 'company', { id: c.id }, s)} · ${esc(c.area)}</p><div class="public-totals"><span><strong>${stock.length}</strong> public listings</span></div>${button('Contact the company', 'enquiry', { company: c.id, agent: a.id }, s, true)}</div><div class="prose"><h2>Property advice.<br>A personal perspective.</h2><p>This fictional professional profile shows an approved biography, areas of focus and published listings. It contains no private CRM records or performance statistics.</p><dl class="key-values"><div><dt>Specialty</dt><dd>${esc(a.specialty)}</dd></div><div><dt>Company</dt><dd>${esc(c.name)}</dd></div><div><dt>Areas</dt><dd>${areasFor(stock)}</dd></div><div><dt>Credentials</dt><dd>Not provided in this sample</dd></div></dl></div></div><div class="section-heading"><h2>Properties represented by ${esc(a.name.split(' ')[0])}.</h2>${link('Filter these properties →', 'properties', { agent: a.id }, s)}</div>${grid(stock, s)}</section>`;
}
const areasFor = (stock) => [...new Set(stock.map((p) => areaBy(p.area).name))].join(', ');
