import { homes, cards } from './estate.js';
import {
  safe,
  titleCase,
  monogram,
  listingsFor,
  propertyCount,
  placeLabel,
} from './reference-directory.js';

const fact = (label, value) => `<div><small>${label}</small><strong>${value}</strong></div>`;

// Only the homes published for this community or developer, in catalogue order.
export function profileHomes(data, kind, id) {
  const ids = new Set(listingsFor(data, kind, id).map((listing) => String(listing.id)));
  return homes.filter((home) => ids.has(String(home.publicId ?? home.id)));
}

function website(entity) {
  const url = String(entity.website || '');
  if (!url.startsWith('https://')) return 'Not supplied';
  return `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(
    new URL(url).hostname.replace(/^www\./, ''),
  )} ↗</a>`;
}

export function profileContent(data) {
  const area = data.page === 'area';
  const kind = area ? 'areas' : 'developers';
  const entity = data.entity;
  const shown = profileHomes(data, kind, entity.id);
  const listings = listingsFor(data, kind, entity.id);
  const count = propertyCount(data, entity.publicListingCount ?? shown.length);
  const types = [...new Set(listings.map((listing) => listing.type))].join(' · ') || 'None yet';
  const image = area && (listings[0]?.image || entity.image);
  const copy = area
    ? `Homes, investments and spaces to explore in ${safe(entity.name)}.`
    : data.site.sample
      ? 'A reference name in the UAE property landscape. Associations shown here are illustrative.'
      : `Published properties associated with ${safe(entity.name)}.`;
  const hero = `<section class="u-company-hero u-place-hero">${
    image ? `<img src="${safe(image)}" alt="">` : ''
  }<div class="e-wrap"><nav class="p-breadcrumb" aria-label="Breadcrumb"><a href="/${kind}">${
    area ? 'Communities' : 'Developers'
  }</a><span>›</span><span>${safe(entity.name)}</span></nav>${
    image ? '' : `<span class="u-company-mark u-place-mark">${safe(monogram(entity.name))}</span>`
  }<p class="e-kicker">${safe(placeLabel(kind, entity))}</p>
    <h1 id="page-title" tabindex="-1">${safe(entity.name)}</h1><p>${copy}</p>
    <span class="u-hero-chip">${safe(titleCase(entity.city || entity.emirate))} · ${count}</span></div></section>`;
  const facts = area
    ? fact('Emirate', safe(titleCase(entity.emirate))) + fact('City', safe(entity.city))
    : fact('Base emirate', safe(titleCase(entity.emirate))) +
      fact('Official website', website(entity));
  const all = area
    ? data.site.sample
      ? '/properties?location=' + encodeURIComponent(entity.name)
      : '/properties?area=' + encodeURIComponent(entity.id)
    : '/properties';
  const collection = shown.length
    ? `<div class="e-grid u-place-properties">${cards(shown)}</div>`
    : `<div class="e-empty"><h3>No published properties here yet</h3>
      <p>New listings appear here as soon as companies publish them.</p>
      <a class="e-text" href="/properties">Browse all properties →</a></div>`;
  const note =
    !area && data.site.sample
      ? '<p class="u-note">Reference name only · property associations are illustrative, not partnerships.</p>'
      : '';
  return `${hero}<section class="e-wrap u-content-section"><div class="u-fact-grid">${facts}${fact(
    'Properties',
    count,
  )}${fact('Property types', safe(types))}</div></section>
    <section class="e-wrap u-content-section u-place-collection"><div class="e-section-head"><div><p class="e-kicker">${
      area ? 'THE COMMUNITY COLLECTION' : 'THE DEVELOPER COLLECTION'
    }</p><h2>Properties ${area ? 'in' : 'by'} ${safe(entity.name)}</h2></div>
    <a class="e-text" href="${all}">All properties →</a></div>${collection}${note}</section>`;
}
