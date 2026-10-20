/**
 * Every translation catalogue, by language and namespace (docs/i18n.md). A feature adds
 * `en/<namespace>.js` and `ar/<namespace>.js` with the same keys and registers both here;
 * `npm run check:i18n` fails when files, keys or placeholders differ.
 */
import arCalculators from './ar/calculators.js';
import arChannels from './ar/channels.js';
import arCommon from './ar/common.js';
import arFieldHints from './ar/fieldHints.js';
import arInbox from './ar/inbox.js';
import arProfile from './ar/profile.js';
import arSignup from './ar/signup.js';
import arSignupErrors from './ar/signupErrors.js';
import arSignupSetup from './ar/signupSetup.js';
import arTeamSeats from './ar/teamSeats.js';
import enCalculators from './en/calculators.js';
import enChannels from './en/channels.js';
import enCommon from './en/common.js';
import enFieldHints from './en/fieldHints.js';
import enInbox from './en/inbox.js';
import enProfile from './en/profile.js';
import enSignup from './en/signup.js';
import enSignupErrors from './en/signupErrors.js';
import enSignupSetup from './en/signupSetup.js';
import enTeamSeats from './en/teamSeats.js';

export const catalogs = Object.freeze({
  en: {
    calculators: enCalculators,
    channels: enChannels,
    common: enCommon,
    profile: enProfile,
    fieldHints: enFieldHints,
    inbox: enInbox,
    signup: enSignup,
    signupErrors: enSignupErrors,
    signupSetup: enSignupSetup,
    teamSeats: enTeamSeats,
  },
  ar: {
    calculators: arCalculators,
    channels: arChannels,
    common: arCommon,
    profile: arProfile,
    fieldHints: arFieldHints,
    inbox: arInbox,
    signup: arSignup,
    signupErrors: arSignupErrors,
    signupSetup: arSignupSetup,
    teamSeats: arTeamSeats,
  },
});
