import { siteHeader } from './site-header.js';
import { professionalFooter } from './property-extras.js';
import { safe, directoryContent } from './reference-directory.js';
import { profileContent } from './reference-profile.js';

const intros = {
  privacy: [
    'WEBSITE INFORMATION',
    'Privacy notice.',
    'Privacy',
    'How this website handles information.',
  ],
  terms: ['WEBSITE INFORMATION', 'Website terms.', 'Terms', 'The terms for using this website.'],
  areas: [
    'COMMUNITIES',
    'Find your sense of place.',
    'Communities',
    'Explore the neighbourhoods behind the collection and the homes published in each one.',
  ],
  developers: [
    'UAE DEVELOPERS',
    'The developers shaping the UAE.',
    'Developers',
    'Discover the names behind the skyline and the properties associated with them.',
  ],
};

function intro(page) {
  const [kicker, title, crumb, copy] = intros[page];
  return `<section class="u-intro"><div class="e-wrap"><nav class="p-breadcrumb" aria-label="Breadcrumb">
    <a href="#home">Home</a><span>›</span><span>${crumb}</span></nav><p class="e-kicker">${kicker}</p>
    <h1 id="page-title" tabindex="-1">${title}</h1><p class="u-intro-copy">${copy}</p></div></section>`;
}

const legal = `<section class="e-wrap u-content-section u-legal"><div class="u-contact-panel">
  <h2>Policy content is being prepared.</h2><p>This content is not a final legal policy. The company
  must supply its reviewed policy before public launch.</p></div></section>`;

export function extraPage() {
  const data = window.__blaqksReference;
  const page = data.page;
  const profile = ['area', 'developer'].includes(page) && data.entity;
  const body = profile
    ? profileContent(data)
    : intro(page) +
      (['privacy', 'terms'].includes(page)
        ? legal
        : `<section class="e-wrap u-directory" id="directory-results">${directoryContent(data)}</section>`);
  return `<div class="estate public-page" data-extra-page="${safe(page)}">${siteHeader(page)}
    <main id="main">${body}</main>${professionalFooter()}</div>`;
}
