/**
 * Every translation catalogue, by language and namespace (docs/i18n.md). A feature adds
 * `en/<namespace>.js` and `ar/<namespace>.js` with the same keys and registers both here;
 * `npm run check:i18n` fails when files, keys or placeholders differ.
 */
import arCalculators from './ar/calculators.js';
import arCommon from './ar/common.js';
import arFieldHints from './ar/fieldHints.js';
import arProfile from './ar/profile.js';
import arSignup from './ar/signup.js';
import arSignupErrors from './ar/signupErrors.js';
import arSignupSetup from './ar/signupSetup.js';
import arTeamSeats from './ar/teamSeats.js';
import enCalculators from './en/calculators.js';
import enCommon from './en/common.js';
import enFieldHints from './en/fieldHints.js';
import enProfile from './en/profile.js';
import enSignup from './en/signup.js';
import enSignupErrors from './en/signupErrors.js';
import enSignupSetup from './en/signupSetup.js';
import enTeamSeats from './en/teamSeats.js';

export const catalogs = Object.freeze({
  en: {
    calculators: enCalculators,
    common: enCommon,
    profile: enProfile,
    fieldHints: enFieldHints,
    signup: enSignup,
    signupErrors: enSignupErrors,
    signupSetup: enSignupSetup,
    teamSeats: enTeamSeats,
  },
  ar: {
    calculators: arCalculators,
    common: arCommon,
    profile: arProfile,
    fieldHints: arFieldHints,
    signup: arSignup,
    signupErrors: arSignupErrors,
    signupSetup: arSignupSetup,
    teamSeats: arTeamSeats,
  },
});
