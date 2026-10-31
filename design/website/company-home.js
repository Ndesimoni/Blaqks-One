import { properties, areas, agents, images } from './data.js';
import { esc, link, button, grid, agentCard } from './helpers.js';
import { search } from './search.js';
import { developerSection } from './developers.js';

const titles = {
  1: 'Considered homes.<br>Exceptional living.',
  2: 'Your next move,<br>beautifully considered.',
  3: 'Places to live.<br>Space to belong.',
  4: 'Extraordinary places.<br>A personal perspective.',
};
export function companyHome(ctx, c) {
  const s = ctx.scope;
  const stock = properties.filter((p) => p.company === c.id);
  const selected = stock.filter((p) => p.purpose === 'buy').slice(0, 2);
  const locations = areas.filter((area) => stock.some((p) => p.area === area.id));
  const team = agents.filter((agent) => agent.company === c.id);
  const hero = selected.find((p) => p.type === 'Villa') || selected[0] || stock[0];
  return `<div class="company-home">
    <section class="company-hero" aria-labelledby="company-hero-title"><div class="company-hero-image"><img src="${hero?.image || images.villa}" alt="Illustrative architectural property photography" width="1200" height="800" fetchpriority="high"><span class="company-photo-caption">Illustrative property photography</span></div><div class="company-hero-copy"><span class="eyebrow">${esc(c.area.toUpperCase())} · PROPERTY, CONSIDERED</span><h1 id="company-hero-title">${titles[ctx.theme]}</h1><p>${esc(c.note)}<br>A thoughtful approach to finding your next address.</p>${link('Explore our properties <span aria-hidden="true">→</span>', 'properties', {}, s, 'company-hero-link')}</div><div class="company-hero-foot"><span>HOMES. PLACES. PEOPLE.</span><span>A new perspective on your next chapter.</span></div></section>
    <section class="company-search-wrap" aria-label="Find a property">${search(s)}</section>
    <section class="section company-collection"><div class="section-heading"><div><span class="eyebrow">THE SELECTED COLLECTION</span><h2>Distinctive places.<br>For the way you live.</h2></div>${link('View all properties →', 'properties', {}, s)}</div>${grid(selected, s, 'two-card')}<p class="collection-caption">A selection of this company's fictional public listings. Explore the collection for sale, rent and holiday stays.</p></section>
    <section class="section company-story"><div class="company-story-photo"><img src="${images.apartment}" alt="Illustrative contemporary living space" width="1200" height="800" loading="lazy"><span class="story-caption">A sense of place.<br>A sense of possibility.</span></div><div class="company-story-copy"><span class="eyebrow">A MORE PERSONAL PERSPECTIVE</span><h2>Good property.<br>Better conversations.</h2><p>Finding the right place starts with understanding what matters to you. The neighbourhood. The light. The way a space fits your everyday life.</p><p>Explore the properties represented by ${esc(c.name)}, then speak directly with the person who knows the listing.</p>${link('Discover our approach →', 'about', {}, s, 'editorial-link')}<div class="company-story-signature">${esc(c.name)}<small>${esc(c.area)} · United Arab Emirates</small></div></div></section>
    <section class="section company-locations"><div class="section-heading"><div><span class="eyebrow">FIND YOUR SENSE OF PLACE</span><h2>Somewhere you'll<br>love to call home.</h2></div><p class="section-intro">Explore the neighbourhoods in our current collection.</p></div><div class="company-area-grid">${locations.map((area, index) => link(`<img src="${area.image}" alt="Illustrative ${esc(area.name)} property" loading="lazy" width="1200" height="800"><span class="area-number">0${index + 1}</span><span><h3>${esc(area.name)}</h3><p>${stock.filter((p) => p.area === area.id).length} public listings · ${esc(area.city)}</p></span><b aria-hidden="true">→</b>`, 'properties', { area: area.id }, s, 'company-area-card')).join('')}</div></section>
    ${developerSection(s)}
    <section class="section company-people"><div class="section-heading"><div><span class="eyebrow">PEOPLE, BEFORE PROPERTY</span><h2>A name. A face.<br>A conversation.</h2></div>${link('Meet our people →', 'agents', {}, s)}</div><div class="people-grid">${team.map((agent) => agentCard(agent, s)).join('')}</div></section>
    ${companyClosing(c, s)}
  </div>`;
}
export function companyClosing(c, scope) {
  return `<section class="section company-closing"><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>Let's find your<br>kind of place.</h2><div><p>Tell us what you have in mind.<br>Start a conversation with ${esc(c.name)}.</p>${button('Make an enquiry →', 'enquiry', { company: c.id }, scope)}</div></section>`;
}
