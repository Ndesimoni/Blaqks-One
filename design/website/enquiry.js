import { heading, esc, button, link, notice, money, avatar } from './helpers.js';
import { enquiryRecipient } from './enquiry-recipient.js';
export function enquiry(ctx) {
  const destination = enquiryRecipient(ctx),
    s = ctx.scope;
  if (!destination) return null;
  const { p, c, a, recipient } = destination;
  if (ctx.query.get('receipt') === '1')
    return `<section class="section page-top narrow"><div class="confirmation"><span class="confirmation-mark">✓</span>${heading('CONFIRMATION PREVIEW', 'This is how confirmation will look.', 'Demonstration only — nothing was sent or saved to the CRM.')}<p>Example recipient: ${esc(recipient)}</p><p class="muted">A live enquiry would receive a receipt only after durable storage succeeds. Provider notification status is a separate step.</p>${button('Continue browsing', 'properties', {}, s)}</div></section>`;
  return `<section class="section page-top">${heading('A CONVERSATION STARTS HERE', p ? 'Ask about this property.' : 'How can we help?', `Design demonstration · Intended recipient: ${esc(recipient)}`)}<div class="enquiry-layout"><form class="form-surface" data-form="enquiry"><input type="hidden" name="listing" value="${esc(p?.id || '')}"><input type="hidden" name="company" value="${esc(c?.id || '')}"><input type="hidden" name="agent" value="${esc(a?.id || '')}">
    <label>Your name<input name="name" autocomplete="name" required maxlength="100" placeholder="Full name"></label>
    <div class="two-columns"><label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.com"></label><label>Phone<input name="phone" type="tel" autocomplete="tel" placeholder="Include your country code"></label></div>
    <small>Provide at least one reply contact. Use fictional details in this prototype.</small>
    <label>Preferred response<select name="preference"><option value="email">Email</option><option value="phone">Phone</option></select></label>
    <label>Your message<textarea name="message" rows="5" required maxlength="2000" placeholder="What would you like to know?"></textarea></label>
    <label class="check"><input name="marketing" type="checkbox">I would also like relevant marketing updates. Optional.</label>
    <p class="muted">Your message is intended for ${esc(recipient)}. Read the ${link('privacy notice', 'legal', { type: 'privacy' }, s, 'privacy-inline')}.</p>
    <p class="form-error" role="alert"></p><button class="button" type="submit">Preview confirmation →</button>${notice('Design preview only. This form does not send messages, create leads or store your entries.')}</form>
    <aside class="form-context">${p ? `<img src="${p.image}" alt="Fictional property sample"><h2>${esc(p.title)}</h2><strong>${money(p)}</strong>` : '<span class="eyebrow">YOUR ENQUIRY DESTINATION</span>'}${a ? avatar(a.name, true) : ''}<h3>${esc(recipient)}</h3><p>Property enquiries belong to the original company. If its listing agent is unavailable, the live service would use that same company’s Admin queue.</p></aside></div></section>`;
}
