import { get } from '../../lib/records.js';
import { leadFieldValue, leadStageOptions } from './selectors.js';

/** Column rule colours: first contact gold, active work green, closing accent, ends muted. */
const tones = {
  new: 'gold',
  contacted: 'gold',
  qualified: 'green',
  viewing: 'green',
  negotiation: 'accent',
  documentation: 'accent',
  closed: 'green',
  lost: 'muted',
  'on hold': 'muted',
};

export const stageTone = (stage) => tones[String(stage).toLowerCase()] || 'muted';

const sameStage = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Missing data is shown as a column but never saved as the literal display sentinel. */
export const canPersistStage = (stage) => !sameStage(String(stage), 'Not recorded');

/**
 * One column per pipeline stage in order, plus any custom stage or "Not recorded" that leads
 * actually use, so every lead appears exactly once. "Not recorded" comes first: leads without
 * a stage are the ones to sort out, and at the far end they would sit off screen.
 */
export function leadColumns(records, stageRecords = records) {
  const stages = leadStageOptions(stageRecords);
  const ordered = [
    ...stages.filter((stage) => !canPersistStage(stage)),
    ...stages.filter(canPersistStage),
  ];
  return ordered.map((stage) => ({
    key: stage,
    title: stage,
    tone: stageTone(stage),
    acceptsMove: canPersistStage(stage),
    items: records.filter((record) => sameStage(leadFieldValue(record, 'Lead stage'), stage)),
  }));
}

/** What the lead wants, in one short line: "Buy · Apartment · Dubai Marina". */
export function leadNeed(record) {
  return ['Buy / rent', 'Property type', 'Preferred communities']
    .map((field) => String(get(record, field) ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** The highest budget as a number, or null when none is recorded. */
export function leadBudget(record) {
  const value = Number(get(record, 'Maximum budget AED'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Whether moving `record` to `stage` changes anything. */
export const changesStage = (record, stage) =>
  canPersistStage(stage) && !sameStage(leadFieldValue(record, 'Lead stage'), stage);
