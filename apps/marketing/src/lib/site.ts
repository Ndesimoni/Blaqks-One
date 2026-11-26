/**
 * Where the website's buttons lead and how to reach us. The CRM and property-site addresses
 * come from the environment at build time; the defaults are the local development servers.
 */
const crm = (process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:5173').replace(/\/$/, '');

export const links = {
  signUp: `${crm}/#/sign-up`,
  signIn: `${crm}/#/sign-in`,
  /** The public Blaqks One property site for buyers and tenants (owner, 2026-11-05). */
  propertySite: process.env.NEXT_PUBLIC_PROPERTY_SITE_URL || 'http://localhost:3000',
};

/** Placeholder contact details until the real ones are chosen; the page tags them Sample. */
export const contact = {
  sample: true,
  whatsapp: '+971 50 000 0000',
  email: 'hello@blaqksone.example',
  office: 'Business Bay, Dubai, United Arab Emirates',
  hours: 'Sunday to Friday, 9 am to 6 pm',
};

export const siteName = 'Blaqks One';
export const siteLine = 'The workspace for real estate teams in the UAE.';
