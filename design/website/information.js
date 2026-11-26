import { companyBy, images } from './data.js';
import { heading, button, link, esc, notice } from './helpers.js';
import { companyInformation } from './company-pages.js';
export function information(ctx) {
  const c = companyBy(ctx.scope.site),
    s = ctx.scope;
  if (c && ['about', 'contact'].includes(ctx.page)) return companyInformation(ctx, c);
  if (ctx.page === 'legal') return legal(ctx);
  if (ctx.page === 'plans')
    return `<section class="section page-top">${heading('FOR PROPERTY BUSINESSES', 'A place for your business to grow.', 'Company websites are planned as an optional add-on or higher-plan feature.')}<div class="two-columns"><article class="feature-card"><span class="eyebrow">CONNECTED CRM</span><h2>Your work, in one place.</h2><p>Relationships, properties and the workflows that connect them.</p>${button('About the platform', 'business')}</article><article class="feature-card dark-panel"><span class="eyebrow">COMPANY WEBSITE</span><h2>Your identity.<br>A considered website.</h2><p>Four themes, approved public listings and your company domain.</p><strong>Plans and prices are not yet set.</strong>${button('Ask about company websites', 'contact', {}, {}, true)}</article></div>${notice('Design information only. No checkout, subscription purchase or billing is available.')}</section>`;
  if (ctx.page === 'business')
    return `<section class="section page-top"><div class="split-feature">${heading('BLAQKS ONE FOR PROFESSIONALS', 'Your business.<br>Thoughtfully connected.', 'A connected CRM and a considered public presence for property companies.')}<img src="${images.office}" alt="Illustrative office design sample"></div><div class="three-columns">${[
      ['Manage relationships', 'Keep company leads and follow-ups within the right team.'],
      ['Present your properties', 'Prepare public listings for exact-version platform review.'],
      [
        'Build your presence',
        'Choose a company theme, publish approved content and connect a domain.',
      ],
    ]
      .map(([t, d]) => `<article class="feature-card"><h2>${t}</h2><p>${d}</p></article>`)
      .join(
        '',
      )}</div><div class="actions">${button('Website options', 'plans')}${button('Contact Blaqks One', 'contact', {}, {}, true)}</div>${notice('These are planned public-website capabilities. This preview does not create an account or activate services.')}</section>`;
  if (ctx.page === 'contact')
    return `<section class="section page-top"><div class="two-columns"><div>${heading(c ? 'CONTACT THE COMPANY' : 'CONTACT BLAQKS ONE', 'Let’s start a conversation.', c ? 'General questions go to your selected company. Property questions are best sent from the property page.' : 'Platform support, business questions or a report about a public listing.')}<div class="prose"><h2>${esc(c?.name || 'Blaqks One')}</h2><p>${c ? 'Your enquiry stays with this company.' : 'Property enquiries belong to the company named on the listing. General platform routing is a proposed support-queue design.'}</p>${button(c ? 'Enquire with the company' : 'Open contact form', 'enquiry', c ? { company: c.id } : { platform: '1' }, s)}</div></div><img class="contact-photo" src="${images.apartment}" alt="Fictional interior design image"></div></section>`;
  return `<section class="section page-top"><div class="split-feature"><div>${heading(c ? 'ABOUT THE COMPANY' : 'ABOUT BLAQKS ONE', c ? 'Property, with a human perspective.' : 'A clearer path to your next place.', c ? c.note : 'Discover properties and the people representing them across the UAE.')}<div class="actions">${button('Explore properties', 'properties', {}, s)}${button(c ? 'Meet our team' : 'Explore companies', c ? 'agents' : 'companies', {}, s, true)}</div></div><img src="${images.villa}" alt="Fictional architectural sample"></div><div class="prose"><h2>Clarity from the first search.</h2><p>${c ? esc(c.name) + ' is a fictional company used to review this design. Its biography and service information demonstrate the layout without inventing a trading history.' : 'Blaqks One connects public property discovery with the companies and agents responsible for each published listing.'}</p><p>Public listing approval, representative details and enquiry ownership stay explicit. Publication approval is not a guarantee of property quality or commercial outcome.</p></div></section>`;
}
function legal(ctx) {
  const privacy = ctx.query.get('type') !== 'terms';
  return `<section class="section page-top narrow">${heading('PUBLIC INFORMATION', privacy ? 'Privacy notice.' : 'Website terms.', 'Design placeholder for reviewed legal content.')}${notice('Not launch-ready legal text. Version, controller, retention periods and jurisdiction-specific wording require review before public use.')}<div class="prose"><h2>${privacy ? 'Who receives your enquiry' : 'Using public property information'}</h2><p>${privacy ? 'Property enquiries are addressed to the company named on the relevant listing. Public-site content and private CRM information are separate.' : 'Listings must display accurate approved information and their responsible company. Availability is checked when a real enquiry is submitted.'}</p><h2>${privacy ? 'Choices and contact' : 'Content and availability'}</h2><p>${privacy ? 'Any optional marketing choice must be separate from responding to your enquiry. This design preview collects no real enquiries and sends nothing.' : 'This prototype uses fictional inventory and illustrative images. No listing shown here is offered for an actual transaction.'}</p>${button('Contact', 'contact', {}, ctx.scope, true)}</div></section>`;
}
