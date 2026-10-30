/**
 * Translation catalogues by language and namespace (docs/i18n.md). New features add
 * English catalogues; the older Arabic preview remains frozen by owner decision.
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
import enAgreementLifecycle from './en/agreementLifecycle.js';
import enAgreements from './en/agreements.js';
import enCalculators from './en/calculators.js';
import enChannels from './en/channels.js';
import enChat from './en/chat.js';
import enCoBroking from './en/coBroking.js';
import enCommon from './en/common.js';
import enDealParties from './en/dealParties.js';
import enEmailAddresses from './en/emailAddresses.js';
import enFieldHints from './en/fieldHints.js';
import enHandoverOffer from './en/handoverOffer.js';
import enHandoverRequests from './en/handoverRequests.js';
import enHandoverReview from './en/handoverReview.js';
import enInbox from './en/inbox.js';
import enInboxRules from './en/inboxRules.js';
import enInboxSaved from './en/inboxSaved.js';
import enInboxSend from './en/inboxSend.js';
import enInboxTriage from './en/inboxTriage.js';
import enListingShares from './en/listingShares.js';
import enListingShareViews from './en/listingShareViews.js';
import enMailbox from './en/mailbox.js';
import enMarketplace from './en/marketplace.js';
import enMarketplaceAnswers from './en/marketplaceAnswers.js';
import enMarketplaceAgreement from './en/marketplaceAgreement.js';
import enMarketplaceBoard from './en/marketplaceBoard.js';
import enMarketplaceJoin from './en/marketplaceJoin.js';
import enMarketplaceRequests from './en/marketplaceRequests.js';
import enNavigation from './en/navigation.js';
import enProfile from './en/profile.js';
import enProperties from './en/properties.js';
import enRecordKeeps from './en/recordKeeps.js';
import enRecordShares from './en/recordShares.js';
import enRecordSorting from './en/recordSorting.js';
import enSignup from './en/signup.js';
import enSignupErrors from './en/signupErrors.js';
import enSignupSetup from './en/signupSetup.js';
import enTeamSeats from './en/teamSeats.js';
import enWebsiteCompanies from './en/websiteCompanies.js';
import enWebsiteEnquiries from './en/websiteEnquiries.js';
import enWebsites from './en/websites.js';
import enWebsiteTeam from './en/websiteTeam.js';

export const catalogs = Object.freeze({
  en: {
    agreementForm: enAgreementForm,
    agreements: enAgreements,
    agreementLifecycle: enAgreementLifecycle,
    calculators: enCalculators,
    channels: enChannels,
    chat: enChat,
    coBroking: enCoBroking,
    common: enCommon,
    dealParties: enDealParties,
    emailAddresses: enEmailAddresses,
    profile: enProfile,
    properties: enProperties,
    fieldHints: enFieldHints,
    inbox: enInbox,
    inboxRules: enInboxRules,
    inboxSaved: enInboxSaved,
    handoverOffer: enHandoverOffer,
    handoverRequests: enHandoverRequests,
    handoverReview: enHandoverReview,
    recordKeeps: enRecordKeeps,
    recordShares: enRecordShares,
    recordSorting: enRecordSorting,
    listingShares: enListingShares,
    listingShareViews: enListingShareViews,
    inboxSend: enInboxSend,
    inboxTriage: enInboxTriage,
    mailbox: enMailbox,
    marketplace: enMarketplace,
    marketplaceAnswers: enMarketplaceAnswers,
    marketplaceAgreement: enMarketplaceAgreement,
    marketplaceJoin: enMarketplaceJoin,
    marketplaceBoard: enMarketplaceBoard,
    marketplaceRequests: enMarketplaceRequests,
    navigation: enNavigation,
    signup: enSignup,
    signupErrors: enSignupErrors,
    signupSetup: enSignupSetup,
    teamSeats: enTeamSeats,
    websiteCompanies: enWebsiteCompanies,
    websiteEnquiries: enWebsiteEnquiries,
    websites: enWebsites,
    websiteTeam: enWebsiteTeam,
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
