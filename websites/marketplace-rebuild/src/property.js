import { properties, images, price, money, companyFor, agentFor, ref, saving } from './data.js';
import { cards, heading } from './components.js';
import { ids, read } from './state.js';

export function propertyPage(id) {
  const p = properties.find(p => p.id === Number(id));
  if (!p) return '<main id="main" class="wrap section"><h1>Property not found.</h1><a href="#properties">Explore properties</a></main>';
  const broker = agentFor(p);
  const back = read('search', '#properties');
  const safeBack = /^#(?:properties|deals)(?:\?|$)/.test(back) ? back.replace(/"/g, '&quot;') : '#properties';
  return `<main id="main" class="wrap property-page"><nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="#home">Home</a><span>›</span><a href="${safeBack}">← Back to results</a><span>› ${p.area}</span></nav>
    <div class="section-heading"><div><p class="eyebrow">EXCEPTIONAL HOMES. EXTRAORDINARY LIVING.</p>
      <h1 id="page-title" tabindex="-1">${p.title}</h1><p>⌖ ${p.area}, Dubai, United Arab Emirates</p>
      <span class="status">${p.status} · sample</span></div><div class="tools">
      <button data-save="${p.id}" aria-pressed="${ids('saved').includes(p.id)}">♡ Save</button>
      <button data-compare="${p.id}" aria-pressed="${ids('compare').includes(p.id)}">Compare</button>
      <button data-share>Share ↗</button></div></div>
    <div class="gallery"><button data-gallery="${p.id}" aria-label="Open property gallery">
      <img src="${images[p.image]}" alt="${p.title}"></button><div>
      <button data-gallery="${p.id}" aria-label="Open illustrative living room photo">
      <img src="${images.living}" alt="Illustrative living space"></button>
      <button data-gallery="${p.id}" aria-label="View all illustrative photos">
      <img src="${images.apartment}" alt="Illustrative apartment"><span>View all photos ↗</span></button></div></div>
    <p class="sample-note">Illustrative photo collection; these images do not depict one verified property. Ref. ${ref(p)}</p>
    <div class="detail-layout"><div><section class="detail-section"><p class="eyebrow">THE ESSENTIALS</p>
      <h2>A space to make your own.</h2><div class="property-facts">
      ${[[p.type === 'Office' ? 'Office' : p.beds || 'Studio', 'Bedrooms'],
        [p.baths, 'Bathrooms'], [p.size.toLocaleString(), 'Square feet'], [p.type, 'Property type']]
        .map(([v, label]) => `<div><strong>${v}</strong><span>${label}</span></div>`).join('')}</div>
      <h3>Beautifully considered. Perfectly placed.</h3>
      <p>A property concept in ${p.area}, imagined around light, space and everyday comfort.
      Explore the specifications and speak with the listing professional about your priorities.</p>
      <p class="sample-note">All descriptions and specifications are illustrative.</p></section>
    <section class="detail-section"><h2>Features & amenities</h2><div class="amenities">
      ${p.amenities.map(a => `<span>✓ ${a}</span>`).join('')}</div><dl class="facts-list">
      ${[['Furnishing', p.furnishing], ['Completion', p.completion], ['Sample status', p.status],
        ['Reference', ref(p)]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
    <section class="detail-section"><h2>Floor plans & tours</h2><div class="media-slots">
      <div><h3>Floor plan</h3><p>No verified plan supplied.</p>
      <button data-enquiry="${p.id}" data-request="floor plan">Request a floor plan →</button></div>
      <div><h3>Video & virtual tour</h3><p>No verified tour supplied.</p>
      <button data-enquiry="${p.id}" data-request="video tour">Ask for a tour →</button></div></div></section>
    <section class="detail-section"><h2>Location</h2><div class="map-placeholder">
      <span>⌖</span><h3>${p.area}, Dubai</h3><p>Map integration placeholder · no geographic pin is verified.</p>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.area + ' Dubai')}"
      target="_blank" rel="noopener noreferrer">Explore the neighbourhood on Google Maps ↗</a></div></section>
    <section class="detail-section"><p class="eyebrow">THE LISTING PROFESSIONAL</p>
      <h2>${broker.name}</h2><p>${companyFor(p).name} · ${broker.focus}</p>
      <a class="text-link" href="#agent/${broker.id}">View agent profile ↗</a></section></div>
    <aside class="enquiry-card"><p class="eyebrow">${p.purpose === 'Rent' ? 'ANNUAL RENT' : 'ASKING PRICE'}</p>
      <h2>${price(p)}</h2><span class="badge inline">${p.deal} deal · sample</span>
      <p>Sample reference: <del>${money(p.reference)}</del> · −${saving(p)}%</p>
      <p class="sample-note">Reference figures and deal context are unverified.</p><hr>
      <h3>${broker.name}</h3><p>${companyFor(p).name}</p>
      <button class="button gold" data-enquiry="${p.id}" data-request="viewing">Request a viewing ↗</button>
      <button class="button secondary" data-enquiry="${p.id}" data-request="message">Send an enquiry</button>
      <button class="button whatsapp" data-whatsapp="${p.id}">WhatsApp contact ↗</button>
      <p class="sample-note">Contact previews only. Live broker delivery is not connected.</p></aside></div>
    <section class="section"><div class="section-heading"><h2>Featured properties.</h2>
      <a href="#properties">Explore all →</a></div><div class="property-grid">
      ${cards(properties.filter(x => x.id !== p.id).slice(0, 3))}</div></section></main>`;
}
