import { OPTIONS } from '../../config/fields.js';
import { leadTier } from '../../lib/crm.js';
import { shiftDay } from '../../lib/dubaiDate.js';
import { get } from '../../lib/records.js';

/**
 * The approved mockup's Leads presets. The first reads "My leads" for someone who sees only
 * their own and "All leads" for the team; it never narrows what the server returned.
 */
export const leadPresets = (mine) => [
  mine ? 'My leads' : 'All leads',
  'New this week',
  'Hot',
  'From the website',
];

const key = (value) => value.toLowerCase();

/** Imported custom values stay visible; missing information has its own filter. */
export function leadFieldValue(record, field) {
  const value = String(get(record, field) ?? '').trim();
  return (
    (OPTIONS[field] || []).find((option) => key(option) === key(value)) || value || 'Not recorded'
  );
}

/** Leads added since Monday of the current Dubai week (`today` is `YYYY-MM-DD`). */
function addedThisWeek(record, today) {
  const added = String(get(record, 'Date added') ?? '').slice(0, 10);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return Boolean(added) && added >= shiftDay(today, -((weekday + 6) % 7)) && added <= today;
}

const presetMatchers = {
  'New this week': addedThisWeek,
  Hot: (record) => leadTier(record) === 'Hot',
  'From the website': (record) => key(leadFieldValue(record, 'Lead source')) === 'website',
};

export function matchesLeadFilters(record, { preset = '', source = '', stage = '', today } = {}) {
  return (
    (!presetMatchers[preset] || presetMatchers[preset](record, today)) &&
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
