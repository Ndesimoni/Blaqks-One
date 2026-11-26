import { safe, titleCase, monogram, countFor, propertyCount } from './reference-directory.js';

// Six developer tiles after Featured Agents on the home page, most published listings first.
export function homeDevelopers(data) {
  if (data.page !== 'home' || document.querySelector('#home-developers')) return;
  const anchor = document.querySelector('#main > .u-compact-featured');
  const ranked = data.catalogue.developers
    .map((developer, index) => ({
      developer,
      index,
      count: countFor(data, 'developers', developer),
    }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, 6);
  if (!anchor || !ranked.length) return;
  const tiles = ranked
    .map(
      ({ developer, count }) => `<a class="e-partner" href="/developers/${encodeURIComponent(
        developer.id,
      )}"><span class="e-avatar" aria-hidden="true">${safe(monogram(developer.name))}</span>
      <span><strong>${safe(developer.name)}</strong><small>${safe(titleCase(developer.emirate))}</small>
      <span>${propertyCount(data, count)}</span></span><b aria-hidden="true">→</b></a>`,
    )
    .join('');
  const illustrative =
    data.site.sample || data.catalogue.listings.some((listing) => listing.developerIllustrative);
  const section = document.createElement('section');
  section.id = 'home-developers';
  section.className = 'e-wrap u-home-developers';
  section.setAttribute('aria-labelledby', 'home-developers-heading');
  section.innerHTML = `<div class="e-section-head"><div><p class="e-kicker">THE NAMES BEHIND THE SKYLINE</p>
    <h2 id="home-developers-heading">UAE developers</h2></div>
    <a class="e-text" href="/developers">View all developers →</a></div>
    <div class="e-partners u-developer-tiles">${tiles}</div>${
      illustrative
        ? '<p class="u-compact-note">Reference names only; associations are illustrative.</p>'
        : ''
    }`;
  anchor.after(section);
}
