import { dealBodyFromDraft, draftFromDeal } from './dealDraft.js';
import { dealStages } from './dealModel.js';
import { formatAed } from '../../../lib/finance/money.js';

/** Column rule colours: early stages gold, active work green, closing accent, ends muted. */
const tones = {
  New: 'gold',
  Qualified: 'green',
  Viewing: 'green',
  Offer: 'accent',
  Negotiation: 'accent',
  Documentation: 'accent',
  Completed: 'green',
  Lost: 'muted',
  Cancelled: 'muted',
  'On hold': 'muted',
};

/** Pipeline columns in stage order; a selected stage focuses the board on that column. */
export function dealColumns(deals, selectedStage = '') {
  const stages = selectedStage && dealStages.includes(selectedStage) ? [selectedStage] : dealStages;
  return stages.map((stage) => {
    const items = deals.filter((deal) => deal.stage === stage);
    const value = items.reduce((sum, deal) => sum + BigInt(deal.agreedValueFils), 0n);
    return {
      key: stage,
      title: stage,
      tone: tones[stage] ?? 'muted',
      summary: `${items.length} · ${formatAed(value)}`,
      items,
    };
  });
}

/**
 * The exact `PATCH` body the deal editor would send for `deal` with only its stage changed,
 * or null when the stage is unknown, unchanged or the saved deal no longer validates.
 */
export function stageMoveBody(deal, stage) {
  if (!dealStages.includes(stage) || deal?.stage === stage) return null;
  return dealBodyFromDraft({ ...draftFromDeal(deal), stage }).body;
}
