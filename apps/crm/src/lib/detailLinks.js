import { detailLinkLabels } from '../config/fields.js';
import { safeExternalUrl } from './validation.js';

/**
 * A labelled external link for a configured URL field, or null. Unsafe, schemeless and
 * unconfigured values return null so detail views show them as plain text instead.
 */
export function detailLink(field, value) {
  const label = detailLinkLabels[field.name];
  const href = label && field.type === 'url' ? safeExternalUrl(value) : '';
  return href ? { href, label } : null;
}
