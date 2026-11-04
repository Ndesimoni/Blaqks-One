/** The four products: the menu line, the product page and its six features. */
export type ProductKey = 'crm' | 'websites' | 'marketplace' | 'messages';
export type IconName =
  'home' | 'crm' | 'web' | 'market' | 'chat' | 'gear' | 'bell' | 'logo' | 'spark';

export type Product = {
  key: ProductKey;
  name: string;
  icon: IconName;
  line: string;
  title: string;
  sub: string;
  art: 'dashboard' | 'listing' | 'offers' | 'chat';
  features: [string, string][];
};

export const products: Product[] = [
  {
    key: 'crm',
    name: 'CRM',
    icon: 'crm',
    line: 'Leads, clients, listings and deals',
    title: 'A CRM built for UAE brokerages',
    sub: 'Leads, clients, listings, viewings and deals, with every conversation on the record.',
    art: 'dashboard',
    features: [
      ['Lead pipeline', 'Every enquiry gets an owner, a score and a next step.'],
      ['Listings', 'Sales, rentals, holiday homes, commercial and off-plan.'],
      ['Viewings and follow-ups', 'A viewing week and deadlines that never slip.'],
      ['Deals and commissions', 'Payments and expenses with approvals.'],
      ['Calculators', 'Purchase, mortgage, rental yield and off-plan plans.'],
      ['Reports', 'Team performance, insights and a search by date.'],
    ],
  },
  {
    key: 'websites',
    name: 'Websites',
    icon: 'web',
    line: 'Your company site, published from listings',
    title: 'Your company website, run from the CRM',
    sub: 'Publish a listing with one switch. Enquiries come back to the agent who owns it.',
    art: 'listing',
    features: [
      ['Company site', 'Your team, listings and contact details.'],
      ['One-switch publishing', 'Publish or withdraw a listing in a click.'],
      ['Agent profiles', 'Each agent controls their own public profile.'],
      ['The Blaqks One site', 'Your listings also reach buyers on our property site.'],
      ['Enquiry routing', 'Every enquiry reaches the right agent.'],
      ['Always current', 'Price and status changes appear straight away.'],
    ],
  },
  {
    key: 'marketplace',
    name: 'Marketplace',
    icon: 'market',
    line: 'Match clients with other brokers’ listings',
    title: 'A marketplace for brokers, not the public',
    sub: 'Match your clients with other brokers’ properties and agree the split before details are shared.',
    art: 'offers',
    features: [
      ['Client requests', 'Budget, area and move-in date, without names.'],
      ['Approved brokerages', 'Only approved companies can take part.'],
      ['Offers', 'Brokers offer listings that fit your client.'],
      ['Agreements', 'Co-broking terms recorded step by step.'],
      ['Private chats', 'Talk to the other broker inside Blaqks One.'],
      ['Your choice', 'Your Admin switches the marketplace on or off.'],
    ],
  },
  {
    key: 'messages',
    name: 'Messages',
    icon: 'chat',
    line: 'WhatsApp, email and team chat together',
    title: 'Every conversation in one inbox',
    sub: 'WhatsApp and email from clients, chat with your team, and private broker chats.',
    art: 'chat',
    features: [
      ['Client inbox', 'WhatsApp and email in one shared place.'],
      ['Assign and hand over', 'Pass a client to a colleague with a note.'],
      ['Saved replies', 'Answer common questions in a click.'],
      ['Team chat', 'Channels, groups and private messages.'],
      ['Marketplace chats', 'Private chats with other brokers.'],
      ['On the record', 'Every message sits on the client’s history.'],
    ],
  },
];

export const productByKey = (key: string) => products.find((product) => product.key === key);
