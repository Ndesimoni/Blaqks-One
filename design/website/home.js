import { images, properties, areas, companyBy } from './data.js';
import { link, button, grid } from './helpers.js';
import { search } from './search.js';
import { companyHome } from './company-home.js';
import { developerSection } from './developers.js';
export function home(ctx) {
  const c = companyBy(ctx.scope.site),
    scope = ctx.scope;
  if (c) return companyHome(ctx, c);
  const cards = properties.filter((p) => p.purpose === 'buy').slice(0, 3);
  return `<section class="hero"><img class="hero-photo" src="${images.villa}" alt="Fictional architectural property photography" width="1200" height="800" fetchpriority="high"><div class="hero-shade"></div><div class="hero-copy"><span class="eyebrow">CONSIDERED HOMES. CLEARER CHOICES.</span><h1>A better place<br>to call home.</h1><p>Discover properties, places and the people who know them.</p></div></section><section class="general-search-wrap" aria-label="Find a property">${search(scope)}</section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">EXPLORE THE POSSIBILITIES</span><h2>Find your next address.</h2></div>${link('View all properties →', 'properties', {}, scope)}</div>${grid(cards, scope, cards.length === 2 ? 'two-card' : '')}</section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">A PLACE FOR EVERY CHAPTER</span><h2>Every neighbourhood. A new possibility.</h2></div>${link('Explore all areas →', 'areas', {}, scope)}</div><div class="area-grid">${areas
      .slice(0, 3)
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
    ${developerSection(scope)}
    ${professionals(scope)}
    <section class="section process"><span class="eyebrow">FROM DISCOVERY TO CONVERSATION</span><h2>Make your next move with clarity.</h2><div class="three-columns"><div><b>01</b><h3>Find your place</h3><p>Browse public properties that match your requirements.</p></div><div><b>02</b><h3>Know your representative</h3><p>Explore the company and agent behind each listing.</p></div><div><b>03</b><h3>Start a conversation</h3><p>Send an enquiry to the company handling the property.</p></div></div></section>`;
}
function professionals(scope) {
  return `<section class="section split-feature"><div><span class="eyebrow">PEOPLE BEHIND THE PROPERTIES</span><h2>The right place.<br>The right people.</h2><p>Meet the companies and agents representing the homes you discover.</p><div class="actions">${button('Explore companies →', 'companies')}${button('Meet the agents', 'agents', {}, scope, true)}</div></div><img src="${images.apartment}" alt="Fictional apartment interior" loading="lazy"></section>`;
}
