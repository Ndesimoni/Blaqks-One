import { properties, images, companyFor, agentFor, ref, escapeHTML as esc } from './data.js';

let opener;
export function showDialog(content) {
  const dialog = document.querySelector('#dialog');
  if (!dialog.open) opener = document.activeElement;
  document.querySelector('#dialog-body').innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

export function closeDialog() {
  document.querySelector('#dialog').close();
  opener?.focus();
}

export function enquiryDialog(id, request = 'message') {
  const p = properties.find(p => p.id === Number(id));
  if (!p) return;
  const broker = agentFor(p);
  showDialog(`<p class="eyebrow">CONTACT THE LISTING PROFESSIONAL</p>
    <h2 id="dialog-title">${request === 'viewing' ? 'Let’s arrange a closer look.' : 'Start a conversation.'}</h2>
    <p>To ${broker.name} · ${companyFor(p).name}</p><p>${p.title} · ${ref(p)}</p>
    <form data-preview-form><label>Your name<input name="name" required autocomplete="name"></label>
    <label>Email address<input name="email" type="email" required autocomplete="email"></label>
    ${request === 'viewing' ? '<label>Preferred date<input type="date" name="date" required></label>' : ''}
    <label>Message<textarea name="message" rows="4" required>${esc('Please share more information about ' +
      (request === 'message' || request === 'viewing' ? p.title : 'the ' + request) + ' (' + ref(p) + ').')}</textarea></label>
    <button class="button navy wide">Preview enquiry →</button>
    <p class="sample-note">No live broker inbox is configured. This preview does not send messages.</p></form>`);
}

export function whatsappDialog(id) {
  const p = properties.find(p => p.id === Number(id));
  if (!p) return;
  showDialog(`<p class="eyebrow">WHATSAPP CONTACT PREVIEW</p>
    <h2 id="dialog-title">A more personal conversation.</h2>
    <p>Listing professional: ${agentFor(p).name} · ${companyFor(p).name}</p>
    <label>Message<textarea id="whatsapp-message" rows="4" readonly>Hello, I’m interested in ${p.title},
    ${ref(p)}, in ${p.area}. Could you share availability and viewing options?</textarea></label>
    <button class="button navy" data-copy-message>Copy message</button>
    <p class="sample-note">A verified broker WhatsApp number is needed before live contact can be enabled.</p>`);
}

export function galleryDialog(id) {
  const p = properties.find(p => p.id === Number(id));
  if (!p) return;
  showDialog(`<h2 id="dialog-title">${p.title}</h2>
    <p>Illustrative photo collection, not one verified property.</p><div class="dialog-gallery">
    ${[p.image, 'living', 'apartment'].map(key =>
      `<img src="${images[key]}" alt="Illustrative ${key} photograph">`).join('')}</div>`);
}
