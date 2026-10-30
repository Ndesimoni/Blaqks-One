import { SUM, amountOf, get } from '../../lib/records.js';
import { monthOf } from '../../lib/dates.js';
import { rollingMonths } from '../reports/selectors.js';

export function selectDashboard(data, summary, reportMonth, now = new Date()) {
  const completed = data.Deals.filter((d) => /completed/i.test(String(get(d, 'Deal stage'))));
  const active = summary.activeDeals;
  const monthLeads = data.Clients.filter(
    (c) => monthOf(get(c, 'Date added')) === reportMonth,
  ).length;
  const monthlyIncome = SUM(
    data.Payments.filter((p) => monthOf(get(p, 'Receipt date')) === reportMonth),
    (p) => amountOf(p, 'Your fee received AED ex VAT'),
  );
  const monthlyExpense = SUM(
    data.Expenses.filter((p) => monthOf(get(p, 'Date paid')) === reportMonth),
    (p) => amountOf(p, 'Amount paid AED'),
  );
  const sources = [
    'Instagram',
    'Referral',
    'Property Finder',
    'Bayut',
    'Website',
    'TikTok',
    'Other',
  ]
    .map((source) => ({
      name: source,
      count: data.Clients.filter((c) => get(c, 'Lead source') === source).length,
    }))
    .filter((x) => x.count > 0);
  const maxSource = Math.max(1, ...sources.map((x) => x.count));
  const chartMonths = rollingMonths(6, now);
  const monthly = chartMonths.map((m) => ({
    month: m,
    amount: SUM(
      data.Payments.filter((p) => monthOf(get(p, 'Receipt date')) === m),
      (p) => amountOf(p, 'Your fee received AED ex VAT'),
    ),
  }));
  const maxBar = Math.max(1, ...monthly.map((x) => x.amount));
  return {
    completed,
    active,
    monthLeads,
    monthlyIncome,
    monthlyExpense,
    sources,
    maxSource,
    monthly,
    maxBar,
  };
}
