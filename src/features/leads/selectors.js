import { OPTIONS } from '../../config/fields.js';
import { get } from '../../lib/records.js';

/** One directory row reads source, stage, contact method, campaign and the next task (UI4a). */
export const leadColumns = [
  'Client ID',
  'Full name',
  'Lead stage',
  'Lead source',
  'Phone',
  'Campaign reference',
  'Next follow-up auto',
];

const key = (value) => value.toLowerCase();

/** Imported custom values stay visible; missing information has its own filter. */
export function leadFieldValue(record, field) {
  const value = String(get(record, field) ?? '').trim();
  return (
    (OPTIONS[field] || []).find((option) => key(option) === key(value)) || value || 'Not recorded'
  );
}

export function matchesLeadFilters(record, { source = '', stage = '' } = {}) {
  return (
    (!source || key(leadFieldValue(record, 'Lead source')) === key(source)) &&
    (!stage || key(leadFieldValue(record, 'Lead stage')) === key(stage))
  );
}

export function selectLeadSources(records) {
  const sources = new Map();
  for (const record of records) {
    const label = leadFieldValue(record, 'Lead source');
    const source = sources.get(key(label)) || { label, count: 0 };
    source.count++;
    sources.set(key(label), source);
  }
  return [...sources.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function leadStageOptions(records, selectedStage = '') {
  const stages = new Map((OPTIONS['Lead stage'] || []).map((stage) => [key(stage), stage]));
  for (const record of records) {
    const stage = leadFieldValue(record, 'Lead stage');
    if (!stages.has(key(stage))) stages.set(key(stage), stage);
  }
  if (selectedStage && !stages.has(key(selectedStage)))
    stages.set(key(selectedStage), selectedStage);
  return [...stages.values()];
}
