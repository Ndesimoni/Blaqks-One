import { properties, agents, companies, images } from './data.js';
import { cards, dealCard, portrait, heading } from './components.js';

export function featuredAgents() {
  return `<section class="wrap section"><div class="section-heading"><div>
    <p class="eyebrow">THE PEOPLE BEHIND YOUR NEXT MOVE</p><h2>Featured agents.</h2></div>
    <a href="#agents">Find your property partner ↗</a></div>
    <div class="agent-strip">${agents.slice(0, 4).map(a => `<a href="#agent/${a.id}" class="mini-agent">
      ${portrait(a)}<div><h3>${a.name}</h3><p>${a.area}</p><small>View profile ↗</small></div></a>`).join('')}
    </div></section>`;
}

export function homePage() {
  return `<main id="main"><section class="hero" style="--hero:url('${images.villa}')">
    <div class="wrap"><p class="eyebrow">EXCEPTIONAL HOMES. EXTRAORDINARY LIVING.</p>
    <h1 id="page-title" tabindex="-1">Find a perfect<br>place to <em>live.</em></h1>
    <p class="hero-description">Discover distinctive homes and connect with the professionals<br>
      who help you make your next move.</p>
    <form id="hero-search" class="hero-search">
      <div class="hero-tabs"><label><input name="purpose" type="radio" value="Buy" checked> Buy</label>
      <label><input name="purpose" type="radio" value="Rent"> Rent</label></div>
      <div class="hero-fields"><label>Location<input name="q" placeholder="Area or property"></label>
      <label>Property type<select name="type"><option value="">All types</option>
      <option>Villa</option><option>Apartment</option><option>Townhouse</option><option>Office</option></select></label>
      <label>Minimum price<input name="min" type="number" min="0" placeholder="AED"></label>
      <label>Maximum price<input name="max" type="number" min="0" placeholder="AED"></label>
      <button class="button gold">Search properties ↗</button></div></form></div></section>
    <div class="wrap benefits">${[
      ['⌂', 'Considered locations', 'Explore Dubai neighbourhoods.'],
      ['◇', 'A personal search', 'Find a space that fits your life.'],
      ['◎', 'Clear property details', 'Compare the things that matter.'],
      ['↗', 'Professional connections', 'Meet the people behind each listing.'],
    ].map(([icon, title, text]) => `<div><span>${icon}</span><h3>${title}</h3><p>${text}</p></div>`).join('')}</div>
    <section class="wrap section"><div class="section-heading"><div>
      <p class="eyebrow">FEATURED PROPERTIES</p><h2>Explore our best listings.</h2></div>
      <a href="#properties">View all properties →</a></div><div class="property-grid">
      ${cards(properties.slice(0, 3))}</div></section>
    <section class="wrap story-banner"><div><p class="eyebrow">A CLEARER WAY FORWARD</p>
      <h2>We help you find<br>the right property.</h2><p>Explore the collection, compare your favourites,
      and start a conversation with the listing professional.</p><a href="#about" class="button gold">
      Discover Blaqks One →</a></div><img src="${images.living}" alt="Contemporary living room" loading="lazy"></section>
    <section class="wrap section"><p class="eyebrow">OPPORTUNITIES, WITH CONTEXT</p>
      <div class="section-heading"><h2>Property deals, in perspective.</h2><a href="#deals">Explore deals →</a></div>
      <div class="deal-intro"><a href="#deals?deal=Distress"><h3>Distress deals ↗</h3>
      <p>Explore sample listings with clearly displayed reference prices.</p></a>
      <a href="#deals?deal=Discount"><h3>Discount deals ↗</h3>
      <p>Compare asking prices with illustrative previous figures.</p></a></div></section>
    <section class="wrap section"><div class="section-heading"><div>
      <p class="eyebrow">A CLOSER LOOK AT THE COLLECTION</p><h2>Distress deals.</h2></div>
      <a href="#deals?deal=Distress">View distress deals →</a></div>
      <div class="property-grid">${properties.filter(p => p.deal === 'Distress').map(dealCard).join('')}</div>
      <p class="sample-note">No seller circumstances or reference prices have been verified.</p></section>
    <section class="professional-banner"><div class="wrap"><p class="eyebrow">FOR AGENTS & COMPANIES</p>
      <h2>Your properties. Your relationships.<br>One connected workspace.</h2>
      <p>Discover the Blaqks One CRM design experience.</p><a class="button gold" href="#professionals">
      Explore the professional workspace ↗</a></div></section>
    <section class="wrap newsletter"><div><h3>Stay in the picture.</h3>
      <p>Follow the properties and places that interest you.</p></div><form data-preview-form>
      <label>Email address<input type="email" required placeholder="you@example.com"></label>
      <button class="button navy">Subscribe</button></form></section>
    ${featuredAgents()}</main>`;
}
