import { themeNames, properties } from './data.js';
import { heading, link, button, notice, select } from './helpers.js';
import { designPanel, contentPanel, enquiriesPanel, settingsPanel } from './editor-fields.js';
export const editorGroups = [
  'overview',
  'design',
  'content',
  'properties',
  'enquiries',
  'settings',
];
export function editor(ctx, state) {
  const section = editorGroups.includes(ctx.query.get('section'))
    ? ctx.query.get('section')
    : 'overview';
  const phase = ctx.query.get('state') || state.draft;
  const warning =
    phase === 'conflict'
      ? 'A newer draft exists. Your entries are kept; review the latest version before retrying.'
      : phase === 'error'
        ? 'The sample save failed. Your draft is still here.'
        : phase === 'changes'
          ? 'Changes requested: review your public contact wording.'
          : '';
  const inner =
    section === 'design'
      ? designPanel(ctx)
      : section === 'content'
        ? contentPanel()
        : section === 'properties'
          ? propertyPanel()
          : section === 'enquiries'
            ? enquiriesPanel()
            : section === 'settings'
              ? settingsPanel(ctx)
              : overview(ctx, phase);
  return `<div class="editor-layout"><aside class="editor-rail"><span class="eyebrow">COMPANY WEBSITE</span><h2>Harbour & Palm</h2><p class="muted">Website workspace</p><nav aria-label="Website sections">${editorGroups.map((g) => link(g[0].toUpperCase() + g.slice(1), 'editor', { section: g, theme: ctx.theme }, {}, section === g ? 'active' : '')).join('')}</nav>${button('Open company website →', 'home', { site: 'harbour', theme: ctx.theme }, {}, true)}</aside><section class="editor-main"><div class="editor-header"><div>${heading('DESIGN PREVIEW', section[0].toUpperCase() + section.slice(1), 'Harbour & Palm Realty · Sample company')}</div><div><span class="status-pill">Live version 2 · Example</span><span class="status-pill">${phase === 'submitted' ? 'Submitted for review' : 'Draft version 3'}</span></div></div>${notice('Website controls are simulations. No domain, content, approval or CRM data is changed. Draft values exist only in this open preview.')}<p class="form-error" role="alert" id="editor-feedback">${warning}</p><form data-form="editor" class="editor-form">${inner}<div class="editor-actions"><button class="button quiet" type="submit">Save draft</button>${button('Preview →', 'home', { site: 'harbour', theme: ctx.theme }, {}, true)}<button class="button" type="button" data-action="submit-review">Submit for review</button><span role="status" id="save-status">${state.saved ? 'Draft saved in this open preview only.' : ''}</span></div></form></section><aside class="editor-preview"><span class="eyebrow">CONTEXTUAL PREVIEW</span><div class="preview-window"><div class="mini-nav">HARBOUR & PALM</div><div class="mini-hero"><h3>Your next chapter.<br>Beautifully placed.</h3></div><div class="mini-search">Buy · Rent · Holiday homes</div><div class="mini-content"><h3>Our properties</h3><div></div><div></div></div></div><p class="muted">${themeNames[Number(ctx.theme) - 1]} · Illustrative preview</p>${button('Open full preview', 'home', { site: 'harbour', theme: ctx.theme }, {}, true)}</aside></div>`;
}
function overview(ctx, phase) {
  return `<div class="overview-intro"><span class="eyebrow">YOUR NEXT STEP</span><h2>${phase === 'submitted' ? 'Your draft is ready for review.' : 'Make your public presence feel like you.'}</h2><p>Work privately on your next version while the approved public version remains separate.</p>${button('Continue editing →', 'editor', { section: 'design', theme: ctx.theme })}</div><div class="two-columns"><article class="feature-card"><h3>Public website</h3><p>harbour.blaqks-one.example</p><span class="status-pill">Live · Example state</span></article><article class="feature-card"><h3>Custom domain</h3><p>www.example.test</p><span class="status-pill">Pending DNS · Example state</span></article></div><h3>Your setup</h3><div class="row-list">${[
    ['Identity and public contact', 'content'],
    ['Theme and branding', 'design'],
    ['Approved properties', 'properties'],
    ['Domain and discovery', 'settings'],
  ]
    .map(
      ([t, s]) => `<div><strong>${t}</strong>${link('Review →', 'editor', { section: s })}</div>`,
    )
    .join('')}</div>`;
}
function propertyPanel() {
  return `<h2>Choose where your listings appear.</h2><p>Only approved public revisions can be displayed. Draft CRM records, received shares and marketplace offers are not public inventory.</p><div class="row-list">${properties
    .filter((p) => p.company === 'harbour')
    .slice(0, 4)
    .map(
      (p) =>
        `<div><span><strong>${p.title}</strong><small>Example approved revision · PREVIEW-${p.id}</small></span>${select(
          'Destination',
          `destination-${p.id}`,
          [
            ['both', 'General + company site'],
            ['company', 'Company site only'],
          ],
          'both',
        )}</div>`,
    )
    .join(
      '',
    )}</div>${notice('One approved publication displayed on both websites occupies one listing slot. Capacity is per physical property/team, not two total properties.')}`;
}
