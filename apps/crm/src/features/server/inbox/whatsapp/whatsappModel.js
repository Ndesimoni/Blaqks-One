import { dubaiToday } from '../../../../lib/dubaiDate.js';

/**
 * The WhatsApp composer's rules (W1b, docs/whatsapp-design.md §5 and §18), mirrored so the
 * composer explains them before a send; the server checks every one again. Words come from
 * the `whatsappSend` catalogue through the keys returned here.
 */
export const TEXT_LIMIT = 4096;
export const VARIABLE_LIMIT = 200;
export const REASON_LIMIT = 500;
export const SOURCES = ['phone', 'in_person', 'form'];

const AGREED = ['client_first', 'phone', 'in_person', 'form', 'client_start', 'admin_restored'];
const STOPPED = ['client_stop', 'recorded_stop'];
// Control characters (line breaks and tabs among them), which WhatsApp refuses in a value.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** '' when a template value would be accepted, else `empty`, `long` or `breaks`. */
export function variableProblem(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'empty';
  if ([...text].length > VARIABLE_LIMIT) return 'long';
  if (CONTROL.test(text) || text.includes('    ')) return 'breaks';
  return '';
}

/** A template body as plain `{text}` and numbered `{variable}` parts, in order. */
export function templateParts(body) {
  const source = String(body ?? '');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(/\{\{(\d+)\}\}/g)) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    parts.push({ variable: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}

/** The text the client receives, filled in one pass (a typed `{{2}}` stays as typed). */
export function filledText(body, values = []) {
  return templateParts(body)
    .map((part) => part.text ?? String(values[part.variable - 1] ?? '').trim())
    .join('');
}

/** The catalogue key for the client's agreement: agreed or stopped with its source, or none. */
export function consentKey(consent) {
  const { state, source } = consent || {};
  if (state === 'opt_in')
    return AGREED.includes(source) ? `consent.agreed_${source}` : 'consent.agreed';
  if (state === 'opt_out')
    return STOPPED.includes(source) ? `consent.stopped_${source}` : 'consent.stopped';
  return 'consent.none';
}

/**
 * What the member may change (§10): agreement for the Admin or staff with the WhatsApp grant
 * while none is in force, STOP for anyone who can see the client, and restoring after a STOP
 * for the Admin only, with a reason.
 */
export function consentActions(user, consent) {
  const admin = user?.roleId === 'admin';
  const granted = admin || user?.channelAccess?.whatsapp === true;
  const state = consent?.state || 'none';
  return {
    agree: granted && state === 'none',
    stop: state !== 'opt_out',
    restore: admin && state === 'opt_out',
  };
}

/** `{key, at}` for the 24-hour window: open until a time today or later, or closed. */
export function windowLabel(window, now = new Date()) {
  if (!window?.open || !window.until) return { key: 'window.closed', at: null };
  const today = dubaiToday(new Date(window.until)) === dubaiToday(now);
  return { key: today ? 'window.openToday' : 'window.openTomorrow', at: window.until };
}

/** The Reply tab: a refusal, free text in an open window, or a template. */
export function replyMode(whatsapp, chosen) {
  if (!whatsapp?.canSend) return 'refused';
  return whatsapp.canSendText && chosen !== 'template' ? 'text' : 'template';
}

/** Whether a template can be sent now, or what comes first. */
export function templateState(consent, templates) {
  if (consent?.state !== 'opt_in') return 'needsAgreement';
  return templates?.length ? 'ready' : 'noTemplates';
}

/** A sent template's name from the offered list, or '' when it is no longer offered. */
export const templateName = (templates, id) =>
  (id && (templates || []).find((template) => template.id === id)?.name) || '';
