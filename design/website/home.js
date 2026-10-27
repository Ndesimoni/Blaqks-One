import { images, properties, areas, companyBy, agents } from './data.js';
import { link, button, heading, esc, grid, agentCard } from './helpers.js';
export function search(scope = {}, compact = false) {
  return `<form class="search-box${compact ? ' compact' : ''}" data-form="search">
    <input type="hidden" name="site" value="${esc(scope.site || '')}"><input type="hidden" name="theme" value="${esc(scope.theme || '')}">
    <fieldset class="purpose"><legend class="sr-only">Property purpose</legend>${[
      ['buy', 'Buy'],
      ['rent', 'Rent'],
      ['holiday', 'Holiday homes'],
    ]
      .map(
        ([v, t], i) =>
          `<label><input type="radio" name="purpose" value="${v}" ${i === 0 ? 'checked' : ''}><span>${t}</span></label>`,
      )
      .join('')}</fieldset>
    <div class="search-fields"><label>Location<select name="area"><option value="">All areas</option>${areas.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label><label>Property type<select name="type"><option value="">All property types</option><option>Apartment</option><option>Villa</option><option>Townhouse</option><option>Office</option></select></label><label>Budget<select name="budget"><option value="">Any budget</option><option value="3000000">Up to AED 3 million</option><option value="5000000">Up to AED 5 million</option></select><small>Sale price; choose Rent/Holiday for its price basis.</small></label><button class="button" type="submit">Search properties <span>→</span></button></div></form>`;
}
export function home(ctx) {
  const c = companyBy(ctx.scope.site),
    scope = ctx.scope;
  const stock = properties.filter((p) => !c || p.company === c.id);
  const cards = stock.filter((p) => p.purpose === 'buy').slice(0, 3);
  return `<section class="hero"><img class="hero-photo" src="${images.villa}" alt="Fictional architectural property photography" width="1200" height="800" fetchpriority="high"><div class="hero-shade"></div><div class="hero-copy"><span class="eyebrow">${c ? esc(c.name) : 'CONSIDERED HOMES. CLEARER CHOICES.'}</span><h1>${c ? 'The next chapter.<br>Beautifully placed.' : 'A better place<br>to call home.'}</h1><p>${c ? esc(c.note) : 'Discover properties, places and the people who know them.'}</p></div><div class="hero-search">${search(scope)}</div></section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">EXPLORE THE POSSIBILITIES</span><h2>${c ? 'Homes with a different perspective.' : 'Find your next address.'}</h2></div>${link('View all properties →', 'properties', {}, scope)}</div>${grid(cards, scope, cards.length === 2 ? 'two-card' : '')}</section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">A PLACE FOR EVERY CHAPTER</span><h2>${c ? 'The places we know.' : 'Every neighbourhood. A new possibility.'}</h2></div>${link('Explore all areas →', 'areas', {}, scope)}</div><div class="area-grid">${areas
      .slice(0, c ? 2 : 3)
      .map((a) =>
        link(
          `<img src="${a.image}" alt="Illustrative ${a.name} property sample" loading="lazy"><span><h3>${a.name}</h3><p>${a.note}</p></span><b>→</b>`,
          'area',
          { id: a.id },
          scope,
          'area-card',
        ),
      )
      .join('')}</div></section>
    ${c ? companyStory(c, scope) : professionals(scope)}
    <section class="section process"><span class="eyebrow">FROM DISCOVERY TO CONVERSATION</span><h2>Make your next move with clarity.</h2><div class="three-columns"><div><b>01</b><h3>Find your place</h3><p>Browse public properties that match your requirements.</p></div><div><b>02</b><h3>Know your representative</h3><p>Explore the company and agent behind each listing.</p></div><div><b>03</b><h3>Start a conversation</h3><p>Send an enquiry to the company handling the property.</p></div></div></section>`;
}
function professionals(scope) {
  return `<section class="section split-feature"><div><span class="eyebrow">PEOPLE BEHIND THE PROPERTIES</span><h2>The right place.<br>The right people.</h2><p>Meet the companies and agents representing the homes you discover.</p><div class="actions">${button('Explore companies →', 'companies')}${button('Meet the agents', 'agents', {}, scope, true)}</div></div><img src="${images.apartment}" alt="Fictional apartment interior" loading="lazy"></section>`;
}
function companyStory(c, scope) {
  return `<section class="section"><div class="section-heading"><div><span class="eyebrow">EXPERTISE, WITH A HUMAN TOUCH</span><h2>Meet your property people.</h2></div>${link('Our story →', 'about', {}, scope)}</div><div class="people-grid">${agents
    .filter((a) => a.company === c.id)
    .map((a) => agentCard(a, scope))
    .join('')}</div></section>`;
}
