/** English catalogues: The app frame: navigation, start page, messenger, shared Kanban, sign-up and account. Registered through catalogs/index.js. */
import enAuth from './en/auth.js';
import enCommon from './en/common.js';
import enFrame from './en/frame.js';
import enKanban from './en/kanban.js';
import enMessenger from './en/messenger.js';
import enNavigation from './en/navigation.js';
import enProducts from './en/products.js';
import enProfile from './en/profile.js';
import enSignup from './en/signup.js';
import enSignupErrors from './en/signupErrors.js';
import enSignupSetup from './en/signupSetup.js';
import enStart from './en/start.js';
import enTeamSeats from './en/teamSeats.js';

export const shellCatalogs = {
  auth: enAuth,
  common: enCommon,
  navigation: enNavigation,
  products: enProducts,
  frame: enFrame,
  start: enStart,
  messenger: enMessenger,
  kanban: enKanban,
  profile: enProfile,
  signup: enSignup,
  signupErrors: enSignupErrors,
  signupSetup: enSignupSetup,
  teamSeats: enTeamSeats,
};
