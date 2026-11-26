// Connected (API) mode only: the approved templates label everything as a design preview.
const sentences = [
  [
    '.p-footer-notice',
    'Property information is published by the listing companies. Confirm listing details and broker credentials before making a property decision.',
  ],
  ['#listings .e-disclaimer', 'Published by companies on Blaqks One. Confirm details with them.'],
  ['.e-card .j-status', 'Published'],
  [
    '.u-company-intro p:not(.e-kicker)',
    'The company’s specialisms, team and published properties, in one place.',
  ],
  [
    '.p-broker-panel .p-small',
    'Contact the listing representative about availability and viewings.',
  ],
];
const phrases = [
  [
    /\bSample (company|agent) profile\b/g,
    (_, kind) => kind[0].toUpperCase() + kind.slice(1) + ' profile',
  ],
  [/\s*·\s*sample( status| profile)?\b/gi, ''],
  [/\b(\d+) sample (listings?|properties|property)\b/gi, '$1 published $2'],
  [/\b(\d+) sample (companies|company|agents|agent)\b/gi, '$1 $2'],
  [/^Illustrative · not verified$/, 'Published profile'],
  [/ this sample property\b/g, ' this property'],
];
const labelled =
  '.j-status, .e-kicker, .u-hero-chip, .u-company-meta span, #u-directory-count, #result-count, .u-fact-grid strong, .j-media-grid p';

export function liveText() {
  // The public contract has no verified deal metadata, so an empty deals strip is removed.
  const deals = document.querySelector('#home-distress-deals');
  if (deals && !deals.querySelector('.d-card')) deals.remove();
  for (const [selector, text] of sentences)
    document.querySelectorAll(selector).forEach((node) => (node.textContent = text));
  document.querySelectorAll(labelled).forEach((node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) continue;
      let text = child.textContent;
      for (const [pattern, replacement] of phrases) text = text.replace(pattern, replacement);
      if (text !== child.textContent) child.textContent = text;
    }
  });
}
