import { preferredCols } from '../../../config/tableColumns.js';
import { workflowColumns } from '../workflowPresentation.js';

/**
 * Desktop columns for the reviewed directories: identity, role or requirement, stage and next
 * task fit beside the action cell at 1280, so nothing is clipped (UI3 §5.4, UI4a).
 */
const pilotColumns = {
  ...workflowColumns,
  Clients: [
    'Client ID',
    'Full name',
    'Lead stage',
    'Buy / rent',
    'Maximum budget AED',
    'Lead quality score / 100',
    'Next follow-up auto',
  ],
  Contacts: [
    'Contact ID',
    'Full name',
    'Contact type',
    'Phone',
    'Email',
    'Company',
    'Building / project',
  ],
};

/** The columns a directory shows until its viewer chooses others. */
export function defaultColumns(module) {
  return pilotColumns[module] || preferredCols[module] || [];
}

/**
 * A remembered choice, kept only for names that are still columns of the sheet. The identity
 * column (the sheet's first) always leads, so every row keeps its ID and Open record action.
 * Anything unreadable falls back to the defaults.
 */
export function cleanColumns(saved, names, fallback) {
  if (!Array.isArray(saved)) return fallback;
  const known = new Set(names);
  const kept = [...new Set(saved.filter((name) => typeof name === 'string' && known.has(name)))];
  if (!kept.length) return fallback;
  const [identity] = names;
  return [identity, ...kept.filter((name) => name !== identity)];
}

/** Ticking adds a column at the end; unticking removes it. The identity column stays. */
export function toggleColumn(columns, name, identity) {
  if (name === identity) return columns;
  return columns.includes(name) ? columns.filter((column) => column !== name) : [...columns, name];
}

export const sameColumns = (a, b) =>
  a.length === b.length && a.every((name, index) => name === b[index]);
