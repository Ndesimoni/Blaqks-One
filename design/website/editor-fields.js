import { themeNames } from './data.js';
import { esc, select, notice, button } from './helpers.js';
export const field = (label, name, value, kind = 'input') =>
  `<label>${label}${kind === 'textarea' ? `<textarea name="${name}" rows="4">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}">`}</label>`;
export function designPanel(ctx) {
  return `<span class="eyebrow">SHAPE YOUR PUBLIC PRESENCE</span><h2>A website that feels like you.</h2><p>Shared structure. Four considered visual directions.</p><div class="theme-grid">${themeNames.map((name, i) => `<label class="theme-choice theme-swatch-${i + 1}"><input type="radio" name="theme" value="${i + 1}" ${ctx.theme === String(i + 1) ? 'checked' : ''}><span class="theme-swatch"><b></b><i></i><i></i></span><strong>${name}</strong><small>${['Photographic', 'Compact split', 'Light editorial', 'Dark architectural'][i]}</small></label>`).join('')}</div>${field('Public site title', 'title', 'Harbour & Palm Realty')}<label>Brand colour<input type="color" name="brand" value="#123d32"></label>${select(
    'Motion',
    'motion',
    [
      ['static', 'Static'],
      ['subtle', 'Subtle depth'],
    ],
    'subtle',
  )}${notice('Phones and reduced-motion visitors always receive the static composition. Full real-time 3D is deferred.')}<p>${button('Open company preview →', 'home', { site: 'harbour', theme: ctx.theme }, {}, true)}</p>`;
}
export function contentPanel() {
  return `<h2>Your story, thoughtfully told.</h2>${field('Company public name', 'name', 'Harbour & Palm Realty')}${field('Homepage headline', 'headline', 'The next chapter. Beautifully placed.')}${field('About the company', 'about', 'Fictional sample company description for this design review.', 'textarea')}<label>Public business email<input name="email" type="email" value="hello@example.test"></label><h3>Pages & navigation</h3><div class="row-list">${['Home', 'Properties', 'About us', 'Contact'].map((p) => `<div><strong>${p}</strong><span>Core page · Included in this preview</span></div>`).join('')}</div><h3>Public people</h3><p>Only opted-in approved professional profiles appear publicly. Internal staff contacts are not published automatically.</p>`;
}
export function enquiriesPanel() {
  return `<h2>Every enquiry, to the right team.</h2>${notice('Property enquiries → Approved listing agent → Same company Admin queue. General company enquiries → Company Admin queue.')}<label class="check"><input type="checkbox" checked>Show the website enquiry form</label>${field('Response-hours information', 'hours', 'Monday–Friday, 09:00–18:00 Asia/Dubai')}${field('Response guidance', 'guidance', 'We will reply through your preferred contact method.', 'textarea')}<h3>Notification preferences</h3><label class="check"><input type="checkbox" checked>Notify authorised company staff when new enquiries arrive</label><p class="muted">Preferences do not connect a mailbox or change lead ownership. This prototype sends nothing.</p>`;
}
export function settingsPanel(ctx) {
  const status = ctx.query.get('domain') || 'pending';
  return `<h2>Your address. Your public identity.</h2>${field('Platform address', 'address', 'harbour.blaqks-one.example')}${field('Custom domain', 'domain', 'www.example.test')}<div class="domain-status"><strong>${status === 'active' ? 'SSL active — simulated' : status === 'removed' ? 'Domain removed — simulated' : 'Pending DNS — simulated'}</strong><p>The example platform subdomain remains available while DNS is pending.</p><button class="button quiet" type="button" data-action="domain">Preview SSL-active state</button></div><h3>Search & sharing</h3>${field('Default page title', 'seo', 'Harbour & Palm Realty | UAE properties')}${field('Search description', 'description', 'Explore our public property collection.', 'textarea')}<h3>Privacy & access</h3><p>Platform legal minimums remain in place. Website editors have no automatic access to CRM leads or private records.</p><h3>History</h3><div class="row-list"><div><strong>Draft updated</strong><span>Sample website editor · Design only</span></div><div><strong>Public version approved</strong><span>Example revision 2 · Not a real publication</span></div></div>`;
}
