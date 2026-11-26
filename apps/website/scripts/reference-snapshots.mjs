import { pathToFileURL } from 'node:url';

export async function referenceSnapshots(root) {
  const load = (name) => import(pathToFileURL(root + '/' + name + '.js'));
  const estate = await load('estate');
  const property = await load('property');
  const properties = await load('properties');
  const publicPages = await load('public-pages');
  const deals = await load('deals');
  const journey = await load('property-journey');
  const account = await load('account-pages');
  const onboarding = await load('onboarding-pages');
  const { authShell, previewToolbar } = await load('components');
  const state = { name: '', email: '', company: '', slug: '', invites: 0 };
  const pages = { home: estate.landing(), properties: properties.propertiesPage() };
  for (const p of estate.homes) pages['property/' + p.id] = property.propertyPage(p.id);
  for (const route of ['agents', 'companies', 'about', 'contact', 'help', 'professionals']) {
    pages[route] = publicPages.publicPage(route);
  }
  for (let id = 0; id < 6; id++) pages['agent/' + id] = publicPages.agentPage(id);
  for (let id = 0; id < 2; id++) pages['company/' + id] = publicPages.companyPage(id);
  for (const route of ['deals', 'distress-deals', 'discount-deals'])
    pages[route] = deals.dealsPage();
  for (const route of ['saved', 'recent', 'compare']) pages[route] = journey.journeyPage(route);
  const auth = {
    signup: account.signup,
    signin: account.signin,
    verify: account.verify,
    reset: account.reset,
    'reset-sent': account.resetSent,
    company: onboarding.company,
    invite: onboarding.invite,
    ready: onboarding.ready,
  };
  for (const [route, page] of Object.entries(auth)) pages[route] = authShell(route, page(state));
  for (const [route, html] of Object.entries(pages)) {
    pages[route] = (html + previewToolbar(route)).replaceAll('assets/', '/approved/assets/');
  }
  return pages;
}
