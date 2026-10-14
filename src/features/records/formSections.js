import { schema } from '../../lib/schema.js';
import { localScheduleFields } from '../../config/calendar.js';
import { activityLayouts } from './formLayouts/activityLayouts.js';
import { listingLayouts } from './formLayouts/listingLayouts.js';
import { peopleLayouts } from './formLayouts/peopleLayouts.js';

const layouts = { ...peopleLayouts, ...listingLayouts, ...activityLayouts };

/** Resolve workbook fields once each, including future fields without silently dropping them. */
export function recordFormSections(module) {
  const scheduleDate =
    module === 'Follow-ups' ? 'due_date' : module === 'Viewings' ? 'appointment_date_time' : null;
  const editable = schema(module).filter((field) => !field.calculated);
  const fields = editable.filter((field) => field.key !== scheduleDate);
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const sections = (layouts[module] || []).map(({ keys, ...definition }) => ({
    ...definition,
    fields: keys.flatMap((key) => {
      const field = byKey.get(key);
      byKey.delete(key);
      return field ? [field] : [];
    }),
  }));
  const remaining = [...byKey.values()];
  for (let index = 0; index < remaining.length; index += 10) {
    sections.push({
      id: `additional-${index / 10}`,
      title: sections.length ? 'Additional details' : 'Record information',
      fields: remaining.slice(index, index + 10),
      media: false,
    });
  }
  const scheduling = [
    ...editable.filter((field) => field.key === scheduleDate),
    ...localScheduleFields(module),
  ];
  if (scheduling.length)
    sections.push({
      id: 'schedule',
      title: 'Scheduling',
      fields: scheduling,
      media: false,
    });
  return sections;
}

export function errorSectionIndex(sections, errors) {
  return sections.findIndex((section) => section.fields.some((field) => errors[field.key]));
}

const formOrderedDetails = new Set(['Contacts']);

/** Appended workbook columns shown beside related details instead of at the end. */
const detailPlacements = { Properties: { after: 'unit_reference', keys: ['address', 'map_link'] } };

/**
 * Contact details follow the form order so the appended location fields sit beside Company;
 * property Address and Map link follow Unit reference.
 */
export function recordDetailFields(module) {
  const fields = schema(module);
  const placement = detailPlacements[module];
  if (placement) {
    const moved = fields.filter((field) => placement.keys.includes(field.key));
    const rest = fields.filter((field) => !placement.keys.includes(field.key));
    const at = rest.findIndex((field) => field.key === placement.after) + 1;
    return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
  }
  if (!formOrderedDetails.has(module)) return fields;
  const keys = recordFormSections(module).flatMap((section) =>
    section.fields.map((field) => field.key),
  );
  const rank = (field) => (keys.includes(field.key) ? keys.indexOf(field.key) : keys.length);
  return [...fields].sort((a, b) => rank(a) - rank(b));
}
