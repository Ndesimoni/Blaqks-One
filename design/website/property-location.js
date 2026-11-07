import { esc, button } from './helpers.js';

// Community framing only. Never derive a public map from a listing's coordinates.
const communityViews = {
  marina: { bounds: [55.124, 25.062, 55.159, 25.099], zoom: 14 },
  hills: { bounds: [55.216, 25.072, 55.272, 25.127], zoom: 13 },
  saadiyat: { bounds: [54.386, 24.508, 54.477, 24.572], zoom: 13 },
};

export function communityMap(areaId) {
  if (!Object.hasOwn(communityViews, areaId)) return null;
  const view = communityViews[areaId];
  const [west, south, east, north] = view.bounds;
  const query = new URLSearchParams({ bbox: view.bounds.join(','), layer: 'mapnik' });
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?${query}`,
    external: `https://www.openstreetmap.org/#map=${view.zoom}/${((south + north) / 2).toFixed(4)}/${((west + east) / 2).toFixed(4)}`,
  };
}

export function propertyLocation(property, area, scope) {
  const map = communityMap(area.id);
  const title = `Map of ${area.name} — approximate community location`;
  return `<section class="detail-section property-location" id="location" aria-labelledby="location-title">
    <span class="eyebrow">THE NEIGHBOURHOOD</span><h2 id="location-title">Location &amp; neighbourhood</h2>
    <p class="location-community">${esc(area.name)}<span>${esc(area.city)}, United Arab Emirates</span></p>
    <p class="location-privacy">Approximate location. Exact address available from the listing agent.</p>
    ${
      map
        ? `<div class="community-map" data-area-map data-map-src="${esc(map.embed)}" data-map-title="${esc(title)}">
      <div class="community-map-stage"><div class="community-map-placeholder"><span aria-hidden="true">⌖</span><strong>${esc(area.name)}</strong><span>Community view · No property pin</span></div></div>
      <div class="community-map-caption"><p data-map-status role="status">The community map loads as you approach this section.</p><button class="button quiet" type="button" data-map-load>Load community map</button></div>
    </div>`
        : '<p class="notice">A community map is not available for this listing. Ask the listing agent about the area.</p>'
    }
    <div class="location-actions">${button('Ask agent for exact location →', 'enquiry', { listing: property.id }, scope, true)}${map ? `<a data-community-map href="${esc(map.external)}" target="_blank" rel="noopener noreferrer">Open community map <span class="sr-only">(opens OpenStreetMap in a new tab)</span><span aria-hidden="true"> →</span></a>` : ''}</div>
    <small class="location-map-note">Illustrative community view for this design sample; not a verified property location.${map ? ' Map © OpenStreetMap contributors. The map service receives the community view, never a private property address.' : ''}</small>
  </section>`;
}
