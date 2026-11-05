import { heading } from './components.js';

const articles = {
  about: ['A CONSIDERED WAY TO CONNECT', 'Exceptional real estate.<br>Thoughtfully connected.',
    'Blaqks One brings property discovery and professional connections into one considered experience.',
    ['Explore a focused collection of homes and commercial spaces.',
     'Compare properties using the details that matter to you.',
     'Discover the agents and companies behind each listing.']],
  professionals: ['FOR AGENTS & COMPANIES', 'Your next chapter.<br>One connected workspace.',
    'Explore the Blaqks One CRM account and onboarding concept.',
    ['Manage professional relationships and properties in the future connected product.',
     'Introduce your company and the professionals behind it.',
     'This standalone website reconstruction is not connected to the private CRM.']],
  privacy: ['BEFORE LAUNCH', 'Privacy notice.',
    'This is a design preview, not a production privacy policy.',
    ['Saved property IDs, comparison IDs and recent views stay in this browser.',
     'Forms in this project do not send messages or create accounts.',
     'Property photography is loaded from Unsplash; image requests reach that external service.',
     'A reviewed privacy notice must be supplied before collecting real customer information.']],
  terms: ['BEFORE LAUNCH', 'Terms & conditions.',
    'Production terms must be supplied and reviewed before launch.',
    ['All listings, prices, deal references, profiles and availability are illustrative.',
     'No property offer, advice or verification is provided by this preview.',
     'Authentication, social providers, email verification and enquiries are simulations.']],
};

export function informationPage(route) {
  if (route === 'contact') return contactPage();
  if (route === 'help') return helpPage();
  const [kicker, title, intro, bullets] = articles[route] || articles.about;
  return `<main id="main">${heading(kicker, title, intro)}<section class="wrap section article">
    <h2>${route === 'professionals' ? 'A workspace built around your business.' : 'A clearer way forward.'}</h2>
    ${bullets.map(t => `<p>${t}</p>`).join('')}
    <a class="button navy" href="#${route === 'professionals' ? 'signup' : 'properties'}">
    ${route === 'professionals' ? 'Create a workspace' : 'Explore properties'} →</a></section></main>`;
}

function contactPage() {
  return `<main id="main">${heading('LET’S START A CONVERSATION', 'Good connections start here.',
    'Tell us what you have in mind.')}<section class="wrap section contact-layout">
    <div><h2>Your next chapter.<br>A personal conversation.</h2><p>Dubai, United Arab Emirates</p>
    <p>Company phone, WhatsApp and inbox details have not been supplied.</p>
    <p class="sample-note">This form is a preview. No message is delivered.</p></div>
    <form data-preview-form><label>Your name<input name="name" autocomplete="name" required></label>
    <label>Email address<input name="email" type="email" autocomplete="email" required></label>
    <label>How can we help?<select name="interest"><option>Buying a property</option>
    <option>Renting a home</option><option>Listing a property</option><option>Professional workspace</option></select></label>
    <label>Your message<textarea name="message" rows="5" required></textarea></label>
    <button class="button navy">Preview enquiry →</button></form></section></main>`;
}

function helpPage() {
  const questions = [
    ['Are these live property listings?', 'No. All property records, professional profiles and reference prices are examples.'],
    ['How do saved properties work?', 'Use the heart on a listing. Saved items remain in this browser when storage is available.'],
    ['Can I compare sale prices and annual rents?', 'Compare them separately. Select up to three properties with the same purpose.'],
    ['Are messages and viewing requests delivered?', 'No. The interface demonstrates the intended flow; a live broker inbox and CRM connection are needed.'],
    ['What is the verification code?', 'Use 246810 in the account design preview. No verification email is sent.'],
  ];
  return `<main id="main">${heading('A LITTLE GUIDANCE', 'How can we help?')}
    <section class="wrap section article">${questions.map(([q, a]) =>
      `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section></main>`;
}
