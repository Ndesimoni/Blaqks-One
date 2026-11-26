import { heading, button, notice } from './helpers.js';
const states = {
  unavailable: [
    'This property is no longer available.',
    'A withdrawn listing cannot accept a new enquiry. Browse current public properties instead.',
  ],
  site: [
    'This company website is unavailable.',
    'The company site may be paused or its entitlement may have ended. No new enquiries can be submitted here.',
  ],
  setup: [
    'A considered website is on its way.',
    'This site has not completed its public-content setup. Saved draft content remains private.',
  ],
  error: [
    'We couldn’t load this page.',
    'Keep your place and try again. This is a deliberately selected design error state.',
  ],
  signin: [
    'CRM sign in is outside this design preview.',
    'The public website and private CRM use separate interfaces. No account credentials are accepted here.',
  ],
  notfound: [
    'There’s no address here.',
    'This page is missing or unavailable. Let’s get you back to somewhere useful.',
  ],
};
export function system(ctx, forced) {
  const key = forced || ctx.query.get('state') || 'notfound';
  const [title, text] = states[key] || states.notfound;
  return `<section class="section page-top narrow system-page"><span class="system-number">${key === 'notfound' ? '404' : key === 'error' ? '↻' : '⌂'}</span>${heading('BLAQKS ONE', title, text)}<div class="actions">${button('Explore properties', 'properties', {}, ctx.scope)}${button('Back to home', 'home', {}, ctx.scope, true)}</div>${notice('Example system state · No production service status is represented.')}</section>`;
}
