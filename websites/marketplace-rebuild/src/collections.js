import { properties, price, money } from './data.js';
import { ids } from './state.js';
import { cards, heading } from './components.js';

export function collectionPage(route) {
  const key = route === 'compare' ? 'compare' : route === 'recent' ? 'recent' : 'saved';
  const list = ids(key).map(id => properties.find(p => p.id === id)).filter(Boolean);
  const title = { compare: 'Compare properties.', recent: 'Recently viewed.', saved: 'Saved properties.' }[route];
  const tabs = '<nav class="collection-tabs"><a href="#saved">Saved properties</a>' +
    '<a href="#recent">Recently viewed</a><a href="#compare">Compare properties</a></nav>';
  const content = route === 'compare' ? comparison(list) : '<div class="property-grid">' + cards(list) + '</div>';
  return `<main id="main">${heading('YOUR PROPERTY COLLECTION', title,
    'Saved in this browser. Sample properties and availability require verification.')}
    <section class="wrap section">${tabs}${list.length ? content :
      '<div class="empty"><h2>Your next property starts here.</h2><p>Save properties as you browse.</p><a class="button navy" href="#properties">Explore properties →</a></div>'}
    </section></main>`;
}

function comparison(list) {
  const rows = [
    ['Price', price], ['Location', p => p.area], ['Type', p => p.type],
    ['Bedrooms', p => p.type === 'Office' ? 'Commercial' : p.beds || 'Studio'],
    ['Bathrooms', p => p.baths], ['Size', p => p.size.toLocaleString() + ' sq ft'],
    ['Furnishing', p => p.furnishing], ['Completion', p => p.completion],
    ['Sample status', p => p.status], ['Amenities', p => p.amenities.join(', ')],
    ['Price per sq ft', p => money(Math.round(p.price / p.size)) +
      (p.purpose === 'Rent' ? ' / year' : ' · sale')],
  ];
  return `<div class="comparison-scroll" tabindex="0" aria-label="Property comparison; scroll horizontally">
    <table><thead><tr><th>Property</th>${list.map(p => `<th><a href="#property/${p.id}">${p.title}</a>
    <button data-compare="${p.id}">Remove</button></th>`).join('')}</tr></thead><tbody>
    ${rows.map(([label, value]) => `<tr><th scope="row">${label}</th>
      ${list.map(p => `<td>${value(p)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}
