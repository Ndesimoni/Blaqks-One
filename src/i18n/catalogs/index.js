/**
 * Every translation catalogue, by language and namespace (docs/i18n.md). A feature adds
 * `en/<namespace>.js` and `ar/<namespace>.js` with the same keys and registers both here;
 * `npm run check:i18n` fails when files, keys or placeholders differ.
 */
import arCalculators from './ar/calculators.js';
import arChannels from './ar/channels.js';
import arChat from './ar/chat.js';
import arCommon from './ar/common.js';
import arEmailAddresses from './ar/emailAddresses.js';
import arFieldHints from './ar/fieldHints.js';
import arInbox from './ar/inbox.js';
import arInboxRules from './ar/inboxRules.js';
import arInboxSend from './ar/inboxSend.js';
import arInboxTriage from './ar/inboxTriage.js';
import arMailbox from './ar/mailbox.js';
import arProfile from './ar/profile.js';
import arSignup from './ar/signup.js';
import arSignupErrors from './ar/signupErrors.js';
import arSignupSetup from './ar/signupSetup.js';
import arTeamSeats from './ar/teamSeats.js';
import enAgreementForm from './en/agreementForm.js';
import enAgreements from './en/agreements.js';
import enCalculators from './en/calculators.js';
import enChannels from './en/channels.js';
import enChat from './en/chat.js';
import enCommon from './en/common.js';
import enEmailAddresses from './en/emailAddresses.js';
import enFieldHints from './en/fieldHints.js';
import enInbox from './en/inbox.js';
import enInboxRules from './en/inboxRules.js';
import enInboxSaved from './en/inboxSaved.js';
import enHandoverOffer from './en/handoverOffer.js';
import enHandoverRequests from './en/handoverRequests.js';
import enHandoverReview from './en/handoverReview.js';
import enInboxSend from './en/inboxSend.js';
import enInboxTriage from './en/inboxTriage.js';
import enMailbox from './en/mailbox.js';
import enProfile from './en/profile.js';
import enSignup from './en/signup.js';
import enSignupErrors from './en/signupErrors.js';
import enSignupSetup from './en/signupSetup.js';
import enTeamSeats from './en/teamSeats.js';

export const catalogs = Object.freeze({
  en: {
    agreementForm: enAgreementForm,
    agreements: enAgreements,
    calculators: enCalculators,
    channels: enChannels,
    chat: enChat,
    common: enCommon,
    emailAddresses: enEmailAddresses,
    profile: enProfile,
    fieldHints: enFieldHints,
    inbox: enInbox,
    inboxRules: enInboxRules,
    inboxSaved: enInboxSaved,
    handoverOffer: enHandoverOffer,
    handoverRequests: enHandoverRequests,
    handoverReview: enHandoverReview,
    inboxSend: enInboxSend,
    inboxTriage: enInboxTriage,
    mailbox: enMailbox,
    signup: enSignup,
    signupErrors: enSignupErrors,
    signupSetup: enSignupSetup,
    teamSeats: enTeamSeats,
  },
  ar: {
    calculators: arCalculators,
    channels: arChannels,
    chat: arChat,
    common: arCommon,
    emailAddresses: arEmailAddresses,
    profile: arProfile,
    fieldHints: arFieldHints,
    inbox: arInbox,
    inboxRules: arInboxRules,
    inboxSend: arInboxSend,
    inboxTriage: arInboxTriage,
    mailbox: arMailbox,
    signup: arSignup,
    signupErrors: arSignupErrors,
    signupSetup: arSignupSetup,
    teamSeats: arTeamSeats,
  },
});
