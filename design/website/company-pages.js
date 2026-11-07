import { agents, properties, areas, images } from './data.js';
import { esc, heading, button, link, avatar, contactActions } from './helpers.js';
import { companyClosing } from './company-home.js';

export function companyInformation(ctx, c) {
  const s = ctx.scope;
  const team = agents.filter((agent) => agent.company === c.id);
  const locations = areas.filter((area) =>
    properties.some((p) => p.company === c.id && p.area === area.id),
  );
  if (ctx.page === 'contact')
    return `<section class="section page-top company-contact"><div class="company-contact-heading">${heading('LET’S TALK PROPERTY', 'Your next move.<br>Starts with a conversation.', `Connect with ${esc(c.name)} in ${esc(c.area)}.`)}<p class="section-intro">Ask about a home, tell us what you're looking for, or get to know the people behind our collection.</p></div><div class="company-contact-layout"><div class="company-contact-office"><img src="${images.apartment}" alt="Illustrative interior, not a company office" width="1200" height="800"><span class="eyebrow">GENERAL COMPANY ENQUIRIES</span><h2>${esc(c.name)}</h2><p>${esc(c.area)}, United Arab Emirates</p><p class="muted">Your enquiry goes directly to this company's team. For a particular property, its named agent is your direct contact.</p>${button('Enquire with the company →', 'enquiry', { company: c.id }, s)}<small>Illustrative company identity. No office address or opening hours have been supplied.</small></div><div><span class="eyebrow">SPEAK TO A LISTING AGENT</span><h2>A more personal<br>point of contact.</h2>${team.map((a) => `<article class="company-contact-person">${avatar(a.name)}<div><h3>${link(esc(a.name), 'agent', { id: a.id }, s)}</h3><p class="muted">${esc(a.specialty)}</p></div>${contactActions(a, null, true)}${link('View profile & properties →', 'agent', { id: a.id }, s, 'editorial-link')}</article>`).join('')}</div></div></section>`;
  return `<section class="section page-top company-about"><div class="company-about-heading">${heading('OUR APPROACH', 'Property is personal.<br>So is our perspective.', esc(c.note))}<p class="section-intro">The right space begins with the right conversation. Get to know the company and the people representing your next place.</p></div><img class="company-about-image" src="${images.villa}" alt="Illustrative architectural image" width="1200" height="800"><div class="company-about-story"><span class="eyebrow">${esc(c.name.toUpperCase())}</span><div><h2>Thoughtful choices.<br>A clearer way forward.</h2><p>${esc(c.name)} brings its public collection and named representatives together in one place. Explore homes, understand the details and contact the agent responsible for each listing.</p><p>This fictional company story demonstrates an editorial layout. Real biographies, credentials and service commitments will be supplied and approved before publication.</p>${link('Meet the people behind the properties →', 'agents', {}, s, 'editorial-link')}</div></div><div class="company-principles">${[
    [
      '01',
      'Start with your priorities',
      'Choose a location, a budget and a property type that fits the way you want to live.',
    ],
    [
      '02',
      'Know the details',
      'Review the published price, property facts and named listing representative.',
    ],
    [
      '03',
      'Keep the conversation personal',
      'Ask the responsible agent about the listing, or contact the company for a general enquiry.',
    ],
  ]
    .map(([n, t, p]) => `<article><span>${n}</span><h3>${t}</h3><p>${p}</p></article>`)
    .join(
      '',
    )}</div><div class="company-about-areas"><span class="eyebrow">PLACES IN OUR COLLECTION</span><div class="actions">${locations.map((area) => button(`${esc(area.name)} →`, 'properties', { area: area.id }, s, true)).join('')}</div></div></section>${companyClosing(c, s)}`;
}
