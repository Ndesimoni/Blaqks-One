import { MODS, schema } from './schema.js';
import { calendarFields } from '../config/calendar.js';
import { normalizeActivity } from '../features/activity/model.js';

export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

/** Validate the shape needed by the UI; keep optional/unknown fields and old metadata. */
export function normalizeWorkspaceData(input) {
  if (!isObject(input)) throw Error('CRM records must be an object containing module arrays.');
  const result = { ...input };
  for (const module of Object.keys(MODS)) {
    const records = input[module] ?? [];
    if (!Array.isArray(records)) throw Error(`${module} must contain a list of records.`);
    const fields = [...schema(module), ...calendarFields(module)];
    const ids = new Set();
    for (const record of records) {
      if (!isObject(record)) throw Error(`${module} contains an invalid record.`);
      const id = String(record[fields[0].key] ?? '').trim();
      if (!id || ids.has(id)) throw Error(`${module} contains a missing or duplicate record ID.`);
      ids.add(id);
      for (const field of fields) {
        const value = record[field.key];
        if (
          value !== undefined &&
          value !== null &&
          !['string', 'number', 'boolean'].includes(typeof value)
        )
          throw Error(`${module}: ${field.name} must be a text or number value.`);
      }
      for (const key of ['media_photos', 'media_floorplans']) {
        if (record[key] === undefined) continue;
        if (!Array.isArray(record[key])) throw Error(`${module} contains invalid media.`);
        for (const asset of record[key]) {
          if (
            !isObject(asset) ||
            typeof asset.name !== 'string' ||
            typeof asset.src !== 'string' ||
            !/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[a-z0-9+/=\s]+$/i.test(
              asset.src,
            ) ||
            (key === 'media_photos' && !asset.src.startsWith('data:image/'))
          )
            throw Error(`${module} contains an unsupported media file.`);
        }
      }
    }
    result[module] = records;
  }
  return result;
}

export function normalizeEnvelope(input) {
  if (!isObject(input) || !isObject(input.data))
    throw Error('The saved workspace has an invalid format.');
  if (input.activity !== undefined) normalizeActivity(input.activity);
  return { ...input, data: normalizeWorkspaceData(input.data) };
}
