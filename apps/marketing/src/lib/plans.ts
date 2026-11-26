/** Plans and the feature table. Prices are samples until the owner sets them. */
export const samplePrices = true;

export type Plan = {
  name: string;
  price: string;
  text: string;
  ticks: string[];
  cta: 'start' | 'trial' | 'talk';
  best?: boolean;
};

export const plans: Plan[] = [
  {
    name: 'Free',
    price: 'AED 0',
    text: 'For a small brokerage getting started.',
    ticks: ['3 seats, including yours', 'All four products', 'Unlimited clients and listings'],
    cta: 'start',
  },
  {
    name: 'Team',
    price: 'AED 149',
    text: 'For growing teams that live in the CRM.',
    ticks: ['Up to 15 seats', 'WhatsApp and email inbox', 'Priority help'],
    cta: 'trial',
    best: true,
  },
  {
    name: 'Business',
    price: 'AED 349',
    text: 'For large brokerages with many branches.',
    ticks: ['Unlimited seats', 'Help moving your data in', 'A named account manager'],
    cta: 'talk',
  },
];

export const ctaLabel = { start: 'Start free', trial: 'Start free trial', talk: 'Talk to us' };

/** Feature by plan: true, false or a short value. */
export const featureRows: [string, ...(string | boolean)[]][] = [
  ['Seats', '3', 'Up to 15', 'Unlimited'],
  ['CRM: leads, clients, listings and deals', true, true, true],
  ['Company website', true, true, true],
  ['Broker marketplace', true, true, true],
  ['WhatsApp and email inbox', false, true, true],
  ['Team chat', true, true, true],
  ['Payment and expense approvals', true, true, true],
  ['Help moving your data in', false, false, true],
  ['Named account manager', false, false, true],
];
