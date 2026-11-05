/**
 * Display labels for connected finance (finance-design §2.3, §4, §7). Status always shows as
 * text, never colour alone; fee bases use the workbook's option names.
 */
export { entryStatusLabels } from './entryModel.js';

export const splitSourceLabels = Object.freeze({
  agreement: 'Agreement',
  team_default: 'Team default',
  override: 'Adjusted by Admin',
  owner: 'Company (no agent)',
});
export const secondSourceLabels = Object.freeze({
  first_agent: "From the agent's share",
  company: 'From the company share',
});
export const paymentStatusLabels = Object.freeze({
  not_earned: 'Not earned',
  outstanding: 'Outstanding',
  paid: 'Paid',
});
export const feeBasisLabels = Object.freeze({ percentage: 'Percentage', fixed: 'Fixed' });
