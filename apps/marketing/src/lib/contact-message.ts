/** The contact form's message: what the form sends and the rules the server checks. */
export type ContactMessage = {
  name: string;
  company: string;
  email: string;
  mobile: string;
  teamSize: string;
  message: string;
};

export const teamSizes = ['1–3 people', '4–15 people', '16–50 people', 'More than 50'];

/** Field problems by field, in plain words; empty when the message can be sent. */
export function checkMessage(
  value: Partial<Record<keyof ContactMessage, unknown>>,
): Partial<Record<keyof ContactMessage, string>> {
  const text = (key: keyof ContactMessage) =>
    typeof value[key] === 'string' ? (value[key] as string).trim() : '';
  const problems: Partial<Record<keyof ContactMessage, string>> = {};
  if (!text('name') || text('name').length > 120) problems.name = 'Enter your full name.';
  if (!text('company') || text('company').length > 160)
    problems.company = 'Enter your company name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text('email')) || text('email').length > 254)
    problems.email = 'Enter a work email, for example you@yourcompany.ae.';
  if (text('mobile') && !/^\+?[0-9 ()-]{7,20}$/.test(text('mobile')))
    problems.mobile = 'Enter a mobile number with the country code, or leave it empty.';
  if (!teamSizes.includes(text('teamSize'))) problems.teamSize = 'Choose your team size.';
  if (!text('message') || text('message').length > 2000)
    problems.message = 'Tell us how we can help, in up to 2,000 characters.';
  return problems;
}
