import { preferredCols } from '../../../config/tableColumns.js';
import { workflowColumns } from '../workflowPresentation.js';

/**
 * Default columns of the approved mockup's grids (owner, 2026-11-01), after the identity column;
 * every other column of the sheet stays one tick away in the column chooser.
 */
const pilotColumns = {
  ...workflowColumns,
  Clients: ['Client ID', 'Full name', 'Phone', 'Last contact auto'],
  Contacts: ['Contact ID', 'Full name', 'Contact type', 'Phone', 'Building / project'],
  Shortlist: ['Match ID', 'Client name auto', 'Property title auto', 'Client response'],
  'Client care': ['Care ID', 'Client name auto', 'Touchpoint type', 'Next contact', 'Task status'],
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
