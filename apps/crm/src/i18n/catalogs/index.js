/**
 * Translation catalogues by language and namespace (docs/i18n.md). New features add an
 * English catalogue and register it in the en-*.js file for their product area; the older
 * Arabic preview remains frozen by owner decision.
 */
import { arabicCatalogs } from './ar-frozen.js';
import { crmCatalogs } from './en-crm.js';
import { marketplaceCatalogs } from './en-marketplace.js';
import { messagesCatalogs } from './en-messages.js';
import { shellCatalogs } from './en-shell.js';
import { websitesCatalogs } from './en-websites.js';

export const catalogs = Object.freeze({
  en: {
    ...shellCatalogs,
    ...crmCatalogs,
    ...messagesCatalogs,
    ...websitesCatalogs,
    ...marketplaceCatalogs,
  },
  ar: arabicCatalogs,
});
