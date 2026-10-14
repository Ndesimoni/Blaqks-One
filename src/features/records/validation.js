import { schema } from '../../lib/schema.js';
import { safeExternalUrl } from '../../lib/validation.js';
import { scheduleErrors } from '../calendar/selectors.js';

export function normalizeRecord(module, record) {
  const normalized = { ...record };
  const id = schema(module)[0].key;
  normalized[id] = String(normalized[id] ?? '').trim();
  if (module === 'Properties' && !normalized.price_basis)
    normalized.price_basis =
      normalized.sale_rental === 'Holiday home'
        ? 'Nightly'
        : normalized.sale_rental === 'Rental'
          ? 'Annual'
          : 'Total price';
  return normalized;
}

/** `idOptional` is for connected creates only, where the server issues a blank ID. */
export function validateRecord(module, record, records = [], original = null, data, rules = {}) {
  const errors = {};
  const fields = schema(module).filter((field) => !field.calculated);
  const id = fields[0].key;
  const value = String(record[id] ?? '').trim();
  if (!value) {
    if (!rules.idOptional) errors[id] = 'A record ID is required.';
  } else if (records.some((row) => String(row[id]).trim() === value && row[id] !== original?.[id]))
    errors[id] = 'That record ID is already in use.';
  for (const field of fields) {
    const value = record[field.key];
    if (value === '' || value === undefined || value === null) continue;
    if (field.type === 'number') {
      if (!Number.isFinite(Number(value)) || Number(value) < 0)
        errors[field.key] = 'Enter a number of zero or greater.';
      else if (
        (/share %|score \/ 100/i.test(field.name) ||
          (field.name === 'Fee rate %' && record.fee_basis !== 'Fixed')) &&
        Number(value) > 100
      )
        errors[field.key] = 'Enter a value between 0 and 100.';
    } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
      errors[field.key] = 'Enter a valid email address.';
    else if (field.type === 'url' && !safeExternalUrl(value))
      errors[field.key] = 'Enter a complete http:// or https:// URL.';
    else if (/^date/.test(field.type)) {
      const date = String(value).slice(0, 10);
      const parsed = new Date(`${date}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
      )
        errors[field.key] = 'Enter a valid date.';
    }
  }
  if (
    module === 'Clients' &&
    record.minimum_budget_aed !== undefined &&
    record.minimum_budget_aed !== '' &&
    record.maximum_budget_aed !== undefined &&
    record.maximum_budget_aed !== '' &&
    Number(record.minimum_budget_aed) > Number(record.maximum_budget_aed)
  )
    errors.maximum_budget_aed = 'Maximum budget must be at least the minimum budget.';
  return { ...errors, ...scheduleErrors(module, record, data, { includeIntegration: false }) };
}

/** Advancing a form checks only the fields shown in its current section. */
export function validateRecordSection(module, record, records, original, fields, data, rules) {
  const keys = new Set(fields.map((field) => field.key));
  return Object.fromEntries(
    Object.entries(validateRecord(module, record, records, original, data, rules)).filter(([key]) =>
      keys.has(key),
    ),
  );
}
