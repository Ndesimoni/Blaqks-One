const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The accessible name of a record's open control: the mockup grid's first cell ("Layla Haddad,
 * open record CL-1") or a row, card or calendar button ("Open record CL-1").
 */
export const openName = (id) => new RegExp(`(^|, )open record ${escape(id)}$`, 'i');

/** Any record's open control, whatever its record. */
export const anyOpenName = /(^|, )open record /i;
