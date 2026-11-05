import { companies, properties } from './data.js';
import { heading, button, link, notice, esc } from './helpers.js';
export const platformGroups = ['general', 'review', 'companies', 'policies', 'health'];
export function platform(ctx, state) {
  const section = platformGroups.includes(ctx.query.get('section'))
    ? ctx.query.get('section')
    : 'general';
  const labels = {
    general: 'General website',
    review: 'Review queue',
    companies: 'Company sites',
    policies: 'Policies & access',
    health: 'Health & recovery',
  };
  return `<div class="editor-layout platform-layout"><aside class="editor-rail"><span class="eyebrow">BLAQKS ONE</span><h2>Website administration</h2><nav aria-label="Platform website sections">${platformGroups.map((s) => link(labels[s], 'platform', { section: s }, {}, section === s ? 'active' : '')).join('')}</nav></aside><section class="editor-main">${heading('PLATFORM DESIGN PREVIEW', labels[section], 'Public content and operational metadata. No private CRM business records.')}${notice('All review, entitlement and recovery controls below are simulated. They do not publish or change access.')}<div class="platform-content">${section === 'general' ? general() : section === 'review' ? review(state) : section === 'companies' ? companySites() : section === 'policies' ? policies() : health()}</div></section></div>`;
}
function general() {
  return `<div class="overview-intro"><span class="eyebrow">THE PUBLIC EXPERIENCE</span><h2>Property discovery.<br>Thoughtfully structured.</h2><p>Manage the general site's public presentation separately from company content and publication review.</p>${button('Open general site →', 'home')}</div><div class="row-list">${[
    ['Homepage composition', 'Homepage sections and approved collections', 'home'],
    ['Property search', 'Public filters, price bases and result layouts', 'properties'],
    ['People and companies', 'Approved professional identity and eligible inventory', 'companies'],
    ['Platform information', 'About, support and legal templates', 'about'],
  ]
    .map(
      ([t, d, path]) =>
        `<div><span><strong>${t}</strong><small>${d}</small></span>${link('Preview →', path)}</div>`,
    )
    .join('')}</div>`;
}
function review(state) {
  return `<div class="review-layout"><div class="row-list"><div><span><strong>Harbour & Palm · Website revision 3</strong><small>Sample public content submission</small></span><span class="status-pill">${state.review || 'Awaiting review'}</span></div><div><span><strong>Property PREVIEW-001 · Revision 2</strong><small>Public snapshot only</small></span>${link('Inspect snapshot →', 'property', { id: '1' })}</div></div><div class="feature-card"><span class="eyebrow">PUBLIC CONTENT COMPARISON</span><h2>What changed?</h2><dl class="key-values"><div><dt>Headline</dt><dd>“Your next home” → “Your next chapter”</dd></div><div><dt>Contact</dt><dd>Approved business address supplied for review</dd></div><div><dt>Assets</dt><dd>New processed hero image version</dd></div></dl><p class="muted">No landlord contacts, private notes or client records are included.</p><div class="actions"><button class="button" data-action="review" data-value="Approved — simulated">Simulate approval</button><button class="button quiet" data-action="review" data-value="Changes requested — simulated">Request changes</button></div><p role="status">${esc(state.review || 'No real decision has been recorded.')}</p></div></div>`;
}
function companySites() {
  return `<h2>Company websites</h2><div class="row-list">${companies.map((c) => `<div><span><strong>${c.name}</strong><small>${c.id}.blaqks-one.example · Company site entitlement</small></span><span class="status-pill">Active · Sample</span>${link('Public preview →', 'home', { site: c.id })}</div>`).join('')}</div><p class="muted">Plan changes, purchases and access controls are not connected in this design.</p>`;
}
function policies() {
  return `<h2>Clear boundaries for every website.</h2><div class="row-list"><div><strong>Public approval</strong><span>Exact-version Super Admin approval</span></div><div><strong>Company ownership</strong><span>Company-bound listing/enquiry destinations</span></div><div><strong>Listing capacity</strong><span>Per-property team limits; general-site cross-company limit</span></div><div><strong>Motion</strong><span>Lightweight depth; static phones/reduced motion</span></div><div><strong>Public scope</strong><span>General + company websites; agent profiles inside</span></div></div>`;
}
function health() {
  return `<h2>Make recovery understandable.</h2><div class="two-columns"><article class="feature-card"><span class="status-pill">Example status</span><h3>Catalogue projection</h3><p>Sample version is up to date.</p></article><article class="feature-card"><span class="status-pill">Action needed · Example</span><h3>Custom domain</h3><p>Ownership check is pending. The platform subdomain remains available.</p>${button('Inspect domain state', 'editor', { section: 'settings' }, {}, true)}</article></div><div class="row-list"><div><span><strong>Notification retry</strong><small>An example stored enquiry would remain durable while notification delivery retries.</small></span><span>Simulation</span></div><div><span><strong>Withdrawn listing</strong><small>Future intake is blocked independently of cached content.</small></span>${link('View unavailable page', 'system', { state: 'unavailable' })}</div></div>`;
}
