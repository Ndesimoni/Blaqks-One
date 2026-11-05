/**
 * The platform figures' reply shape (BO1d), as `GET /platform/metrics` returns it: nested
 * groups whose leaves are figures (a whole count, whole fils or null) or the general site's
 * live flag. metricsModel.js checks a reply against it.
 */
export const RECORD_TYPES = [
  'Clients',
  'Contacts',
  'Properties',
  'Follow-ups',
  'Viewings',
  'Shortlist',
  'Interaction log',
  'Client care',
];
export const TREND_SERIES = [
  'companiesNew',
  'usersNew',
  'monthlyActiveUsers',
  'recordsAdded',
  'enquiries',
  'dealsEarned',
  'dealsEarnedValueFils',
  'interBrokerAgreements',
];
export const FIGURE = 'figure';
export const FLAG = 'flag';
const figures = (...keys) => Object.fromEntries(keys.map((key) => [key, FIGURE]));

export const SHAPE = {
  totals: {
    companies: figures('total', 'active', 'archived'),
    users: figures('total', 'admins', 'staff', 'pending'),
    activeUsers: figures('today', 'last7Days', 'last30Days'),
    records: { ...figures('total'), byType: figures(...RECORD_TYPES) },
    websites: { ...figures('companySitesLive', 'listingsLive'), generalSiteLive: FLAG },
    deals: figures(
      'recorded',
      'open',
      'earned',
      'lost',
      'earnedValueFils',
      'openValueFils',
      'commissionEarnedFils',
      'averageEarnedValueFils',
    ),
    payments: figures('recorded', 'approvedFils'),
    interBroker: figures(
      'agreements',
      'accepted',
      'completed',
      'valueFils',
      'commissionSharedFils',
    ),
    marketplace: figures('companiesApproved', 'members', 'requestsPosted', 'answers'),
    ...figures('outsideAgents', 'websiteVisitors'),
  },
  inPeriod: {
    ...figures(
      'companiesNew',
      'usersNew',
      'recordsAdded',
      'enquiries',
      'enquiriesToLeads',
      'viewings',
      'dealsEarned',
      'dealsEarnedValueFils',
      'interBrokerAgreements',
      'interBrokerValueFils',
      'emailsSent',
      'whatsappSent',
      'chatMessages',
      'signIns',
    ),
    websiteSales: figures('deals', 'valueFils'),
  },
  growth: figures(
    'companiesActiveThisMonth',
    'companiesActiveLastMonth',
    'companiesStopped',
    'medianDaysToFirstEarnedDeal',
  ),
};
