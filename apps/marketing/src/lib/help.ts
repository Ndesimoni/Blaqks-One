/** Help centre answers, by topic; the home page shows the first five. */
export type HelpItem = { topic: string; q: string; a: string };

export const help: HelpItem[] = [
  {
    topic: 'Getting started',
    q: 'Is the Free plan really free?',
    a: 'Yes. Three seats and all four products cost nothing, and you do not need a card to sign up.',
  },
  {
    topic: 'Team and access',
    q: 'Can my agents see each other’s clients?',
    a: 'Not unless you allow it. Each agent sees the clients and listings assigned to them, and you can give team access to the people who need it.',
  },
  {
    topic: 'Getting started',
    q: 'How do I sign up?',
    a: 'Use your work email, confirm the six-digit code we send you, then add your company name and emirate. Your workspace opens straight away.',
  },
  {
    topic: 'Marketplace',
    q: 'Are my client details shared on the marketplace?',
    a: 'No. Requests show the area, budget and dates only. Names and contacts stay hidden until both brokers agree a split.',
  },
  {
    topic: 'Websites',
    q: 'Do I need my own website first?',
    a: 'No. Your company site is part of Blaqks One, and your listings appear on it as soon as you switch them on.',
  },
  {
    topic: 'Getting started',
    q: 'Can I bring my clients and listings from a spreadsheet?',
    a: 'Our team can help you move your records in. Talk to us and tell us what you use today.',
  },
  {
    topic: 'Team and access',
    q: 'How do I add my team?',
    a: 'Invite colleagues from Settings, Team and access. Each gets a private link and chooses their own password.',
  },
  {
    topic: 'Billing',
    q: 'What happens when I need more seats?',
    a: 'Paid plans with more seats are coming. Your records and team stay exactly as they are when you move.',
  },
];

export const topics = ['All', ...new Set(help.map((item) => item.topic))];

/** Answers in a topic ('All' for every topic) whose question or answer contains the query. */
export function searchHelp(items: HelpItem[], query: string, topic = 'All'): HelpItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      (topic === 'All' || item.topic === topic) &&
      (!needle || `${item.q} ${item.a}`.toLowerCase().includes(needle)),
  );
}
