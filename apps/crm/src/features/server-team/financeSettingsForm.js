/**
 * Team finance settings form (finance-design §7, §14.3). Percentages stay text in the draft and
 * become whole basis points through `parsePercent`, so no value passes through a float.
 */
import { bpToPercent, parsePercent } from '../../lib/finance/money.js';

export const DEFAULT_VAT_RATE_BP = 500;
export const secondSourceOptions = [
  ['first_agent', "The first agent's share"],
  ['company', "The company's share"],
];
export const settingsMessages = {
  agentShare: "Enter the agent's share, such as 50.",
  maxReferralShare: 'Enter the largest referral share, or 0 for full hand-overs only.',
  trn: 'Enter a 15-digit TRN.',
  secondAgentSource: 'Choose a valid second-agent split source.',
};

/** Editable text for saved team settings, or first-time defaults when none exist yet. */
export function settingsDraft(settings) {
  return {
    agentShare: settings ? bpToPercent(settings.agentShareBp) : '',
    secondAgentSource: settings?.secondAgentSource ?? 'first_agent',
    maxReferralShare: settings ? bpToPercent(settings.maxReferralShareBp) : '0',
    vatRegistered: settings?.vatRegistered ?? false,
    trn: settings?.trn ?? '',
  };
}

const percentError = (text, missing) => {
  const { value, error } = parsePercent(text);
  return error || (value === null ? missing : '');
};

/** Field errors; an empty object means the draft can be saved. */
export function settingsErrors(draft) {
  const errors = {
    agentShare: percentError(draft.agentShare, settingsMessages.agentShare),
    maxReferralShare: percentError(draft.maxReferralShare, settingsMessages.maxReferralShare),
    trn: draft.trn.trim() && !/^\d{15}$/.test(draft.trn.trim()) ? settingsMessages.trn : '',
    secondAgentSource: secondSourceOptions.some(([value]) => value === draft.secondAgentSource)
      ? ''
      : settingsMessages.secondAgentSource,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** The settings object `saveFinanceSettings` sends; `version` is null before first setup. */
export function settingsBody(draft, settings) {
  return {
    version: settings?.version ?? null,
    agentShareBp: parsePercent(draft.agentShare).value,
    secondAgentSource: draft.secondAgentSource,
    maxReferralShareBp: parsePercent(draft.maxReferralShare).value,
    vatRegistered: draft.vatRegistered,
    trn: draft.trn.trim() || null,
  };
}

/** "Company keeps 40%" for a valid agent share, or ''. */
export function companyShareText(agentShare) {
  const { value } = parsePercent(agentShare);
  return value === null ? '' : `The company keeps ${bpToPercent(10_000 - value)}%.`;
}

/** True when the draft differs from what was loaded. */
export const settingsDirty = (draft, settings) =>
  JSON.stringify(draft) !== JSON.stringify(settingsDraft(settings));
