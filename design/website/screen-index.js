import { heading, link } from './helpers.js';
import { themeNames } from './data.js';
export const screens = [
  [
    'General website',
    [
      ['Homepage', 'home', {}],
      ['All properties', 'properties', {}],
      ['Buy', 'properties', { purpose: 'buy' }],
      ['Rent', 'properties', { purpose: 'rent' }],
      ['Holiday homes', 'properties', { purpose: 'holiday' }],
      ['Property detail', 'property', { id: '1' }],
      ['Companies directory', 'companies', {}],
      ['Company profile', 'company', { id: 'harbour' }],
      ['Company agents tab', 'company', { id: 'harbour', tab: 'agents' }],
      ['Company About tab', 'company', { id: 'harbour', tab: 'about' }],
      ['Company Contact tab', 'company', { id: 'harbour', tab: 'contact' }],
      ['Agents directory', 'agents', {}],
      ['Agent profile', 'agent', { id: 'maya' }],
      ['Areas directory', 'areas', {}],
      ['Area detail', 'area', { id: 'marina' }],
    ],
  ],
  [
    'Enquiries & information',
    [
      ['Listing enquiry', 'enquiry', { listing: '1' }],
      ['Company enquiry', 'enquiry', { company: 'harbour' }],
      ['Confirmation preview', 'enquiry', { listing: '1', receipt: '1' }],
      ['About Blaqks One', 'about', {}],
      ['Contact Blaqks One', 'contact', {}],
      ['For professionals', 'business', {}],
      ['Plan information', 'plans', {}],
      ['Privacy template', 'legal', { type: 'privacy' }],
      ['Terms template', 'legal', { type: 'terms' }],
    ],
  ],
  [
    'Company website',
    [
      ['Company homepage', 'home', { site: 'harbour' }],
      ['Company listings', 'properties', { site: 'harbour' }],
      ['Company property detail', 'property', { site: 'harbour', id: '1' }],
      ['Company About', 'about', { site: 'harbour' }],
      ['Company Contact', 'contact', { site: 'harbour' }],
      ['Company team', 'agents', { site: 'harbour' }],
      ['Company agent profile', 'agent', { site: 'harbour', id: 'maya' }],
    ],
  ],
  [
    'Company website editor',
    [
      ['Overview', 'editor', { section: 'overview' }],
      ['Brand & design', 'editor', { section: 'design' }],
      ['Content & people', 'editor', { section: 'content' }],
      ['Properties', 'editor', { section: 'properties' }],
      ['Enquiries', 'editor', { section: 'enquiries' }],
      ['Settings / domain / SEO / history', 'editor', { section: 'settings' }],
      ['Submitted draft', 'editor', { state: 'submitted' }],
      ['Changes requested', 'editor', { state: 'changes' }],
      ['Save failure', 'editor', { state: 'error' }],
      ['Version conflict', 'editor', { state: 'conflict' }],
      ['SSL active example', 'editor', { section: 'settings', domain: 'active' }],
      ['Domain removed', 'editor', { section: 'settings', domain: 'removed' }],
    ],
  ],
  [
    'Platform website administration',
    [
      ['General-site presentation', 'platform', { section: 'general' }],
      ['Public review and diff', 'platform', { section: 'review' }],
      ['Company sites & entitlement', 'platform', { section: 'companies' }],
      ['Policies & access', 'platform', { section: 'policies' }],
      ['Health & recovery', 'platform', { section: 'health' }],
    ],
  ],
  [
    'Empty, error & system states',
    [
      ['No matching properties', 'properties', { q: 'no-such-sample' }],
      ['No matching companies', 'companies', { q: 'no-such-sample' }],
      ['No matching agents', 'agents', { q: 'no-such-sample' }],
      ['Listing unavailable', 'system', { state: 'unavailable' }],
      ['Company site unavailable', 'system', { state: 'site' }],
      ['Site setup pending', 'system', { state: 'setup' }],
      ['Generic failure', 'system', { state: 'error' }],
      ['Not found', 'system', { state: 'notfound' }],
      ['CRM boundary', 'system', { state: 'signin' }],
    ],
  ],
];
export function screenIndex() {
  return `<section class="section page-top">${heading('BLAQKS ONE · COMPLETE DESIGN PREVIEW', 'Every page.<br>One considered experience.', 'Explore the public journey and the website editor. All people, properties and companies are fictional; no live services are connected.')}<div class="theme-links">${themeNames.map((name, i) => link(`Theme ${i + 1} · ${name} →`, 'home', { site: 'harbour', theme: String(i + 1) }, {}, 'button quiet')).join('')}</div><div class="screen-index">${screens.map(([group, items]) => `<section class="index-group"><span class="eyebrow">${items.length} SCREENS / STATES</span><h2>${group}</h2>${items.map(([title, path, q]) => link(`${title}<span>→</span>`, path, q)).join('')}</section>`).join('')}</div><p class="notice">Design coverage is not production implementation. Legal copy is a placeholder; forms and approval/domain controls are demonstrations only. Published inventory counts are derived from the fictional sample data.</p></section>`;
}
