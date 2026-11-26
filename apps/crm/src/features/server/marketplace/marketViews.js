/** Each Marketplace route's view (design queue items 26–30); null for other routes. */
const VIEWS = {
  Marketplace: 'board',
  'My requests': 'mine',
  'Marketplace updates': 'updates',
  'Broker profile': 'profile',
};

export const marketView = (route) => VIEWS[route] || null;
