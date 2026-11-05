import { RECORD_TYPES, websitesLive } from './metricsModel.js';

/**
 * The dashboard's figure panels, used by the screen and the CSV alike. Each row reads one
 * platform figure; `period` rows count the chosen period, the rest are totals today. Labels
 * are `platformFigures.<key>`; a row with `hint` adds `platformFigures.hint.<key>`. Money is
 * platform-wide only: no row ever names a company.
 */
const row = (key, read, kind = 'count', extra = {}) => ({ key, read, kind, ...extra });
const inPeriod = (key, read, kind = 'count', extra = {}) =>
  row(key, read, kind, { ...extra, period: true });

const totals = (m) => m.totals;
const recordKeys = [
  'type.clients',
  'type.contacts',
  'type.properties',
  'type.followUps',
  'type.viewings',
  'type.shortlist',
  'type.interactionLog',
  'type.clientCare',
];

export const figureSections = [
  {
    key: 'websites',
    rows: [
      row('websitesLive', (m) => websitesLive(totals(m).websites)),
      row('companySites', (m) => totals(m).websites.companySitesLive),
      row('generalSite', (m) => totals(m).websites.generalSiteLive, 'flag'),
      row('listingsLive', (m) => totals(m).websites.listingsLive),
      inPeriod('enquiries', (m) => m.inPeriod.enquiries),
      inPeriod('enquiriesToLeads', (m) => m.inPeriod.enquiriesToLeads),
      inPeriod('websiteSales', (m) => m.inPeriod.websiteSales.deals),
      inPeriod('websiteSalesValue', (m) => m.inPeriod.websiteSales.valueFils, 'money'),
    ],
  },
  {
    key: 'deals',
    rows: [
      row('dealsRecorded', (m) => totals(m).deals.recorded),
      row('dealsOpen', (m) => totals(m).deals.open),
      row('dealsEarned', (m) => totals(m).deals.earned),
      row('dealsLost', (m) => totals(m).deals.lost),
      row('earnedValue', (m) => totals(m).deals.earnedValueFils, 'money'),
      row('openValue', (m) => totals(m).deals.openValueFils, 'money'),
      row('commissionEarned', (m) => totals(m).deals.commissionEarnedFils, 'money'),
      row('averageDeal', (m) => totals(m).deals.averageEarnedValueFils, 'money'),
      row('paymentsRecorded', (m) => totals(m).payments.recorded),
      row('paymentsApproved', (m) => totals(m).payments.approvedFils, 'money'),
      inPeriod('dealsEarnedPeriod', (m) => m.inPeriod.dealsEarned),
      inPeriod('dealsValuePeriod', (m) => m.inPeriod.dealsEarnedValueFils, 'money'),
    ],
  },
  {
    key: 'interBroker',
    rows: [
      row('agreements', (m) => totals(m).interBroker.agreements),
      row('agreementsAccepted', (m) => totals(m).interBroker.accepted),
      row('agreementsCompleted', (m) => totals(m).interBroker.completed),
      row('agreementValue', (m) => totals(m).interBroker.valueFils, 'money'),
      row('commissionShared', (m) => totals(m).interBroker.commissionSharedFils, 'money'),
      inPeriod('agreementsPeriod', (m) => m.inPeriod.interBrokerAgreements),
      inPeriod('agreementValuePeriod', (m) => m.inPeriod.interBrokerValueFils, 'money'),
    ],
  },
  {
    key: 'marketplace',
    rows: [
      row('marketCompanies', (m) => totals(m).marketplace.companiesApproved),
      row('marketMembers', (m) => totals(m).marketplace.members),
      row('requestsPosted', (m) => totals(m).marketplace.requestsPosted),
      row('answers', (m) => totals(m).marketplace.answers),
    ],
  },
  {
    key: 'growth',
    rows: [
      row('activeThisMonth', (m) => m.growth.companiesActiveThisMonth),
      row('activeLastMonth', (m) => m.growth.companiesActiveLastMonth),
      row('companiesStopped', (m) => m.growth.companiesStopped, 'count', { hint: true }),
      row('daysToFirstDeal', (m) => m.growth.medianDaysToFirstEarnedDeal, 'days'),
      inPeriod('companiesNew', (m) => m.inPeriod.companiesNew),
      inPeriod('usersNew', (m) => m.inPeriod.usersNew),
    ],
  },
  {
    key: 'people',
    rows: [
      row('usersTotal', (m) => totals(m).users.total),
      row('admins', (m) => totals(m).users.admins),
      row('staff', (m) => totals(m).users.staff),
      row('pending', (m) => totals(m).users.pending),
      row('activeToday', (m) => totals(m).activeUsers.today),
      row('active7', (m) => totals(m).activeUsers.last7Days),
      row('active30', (m) => totals(m).activeUsers.last30Days),
    ],
  },
  {
    key: 'activity',
    rows: [
      inPeriod('emailsSent', (m) => m.inPeriod.emailsSent),
      inPeriod('whatsappSent', (m) => m.inPeriod.whatsappSent),
      inPeriod('chatMessages', (m) => m.inPeriod.chatMessages),
      inPeriod('signIns', (m) => m.inPeriod.signIns),
      inPeriod('recordsAdded', (m) => m.inPeriod.recordsAdded),
      inPeriod('viewings', (m) => m.inPeriod.viewings),
    ],
  },
  {
    key: 'records',
    rows: [
      row('recordsTotal', (m) => totals(m).records.total),
      ...RECORD_TYPES.map((type, index) =>
        row(recordKeys[index], (m) => totals(m).records.byType[type]),
      ),
    ],
  },
  {
    key: 'outside',
    rows: [
      row('outsideAgents', (m) => totals(m).outsideAgents, 'count', { hint: true }),
      row('websiteVisitors', (m) => totals(m).websiteVisitors, 'count', { hint: true }),
    ],
  },
];
