import { preferredCols } from '../../../config/tableColumns.js';
import { workflowColumns } from '../workflowPresentation.js';

/**
 * The directories drawn as the approved mockup's grid (owner, 2026-11-01): no ID column by
 * default, a select column and the first cell opening the record. Other tables keep their ID
 * first and their row buttons until their own design step.
 */
export const mockupGrids = new Set([
  'Clients',
  'Contacts',
  'Shortlist',
  'Client care',
  'Viewings',
  'Leads',
]);

/** Default columns; every other column of the sheet stays one tick away in the chooser. */
const pilotColumns = {
  ...workflowColumns,
  Clients: ['Full name', 'Phone', 'Agent', 'Last contact auto'],
  Contacts: ['Full name', 'Contact type', 'Phone', 'Building / project'],
  Shortlist: ['Client name auto', 'Property title auto', 'Client response'],
  'Client care': ['Client name auto', 'Touchpoint type', 'Next contact', 'Task status'],
  Viewings: ['Appointment date & time', 'Property title auto', 'Client name auto'],
  Leads: ['Full name', 'Looking for', 'Maximum budget AED', 'Lead stage', 'Agent', 'Lead source'],
};

/** The columns a directory shows until its viewer chooses others. */
export function defaultColumns(module) {
  return pilotColumns[module] || preferredCols[module] || [];
}

/**
 * A remembered choice, kept only for names that are still columns of the sheet. A `fixed`
 * column (the ID of a table that is not a mockup grid) always leads, so its rows keep their ID
 * and Open record action. Anything unreadable falls back to the defaults.
 */
export function cleanColumns(saved, names, fallback, fixed) {
  if (!Array.isArray(saved)) return fallback;
  const known = new Set(names);
  const kept = [...new Set(saved.filter((name) => typeof name === 'string' && known.has(name)))];
  if (!kept.length) return fallback;
  return fixed ? [fixed, ...kept.filter((name) => name !== fixed)] : kept;
}

/** Ticking adds a column at the end; unticking removes it, except a fixed or the last column. */
export function toggleColumn(columns, name, fixed) {
  if (name === fixed) return columns;
  if (!columns.includes(name)) return [...columns, name];
  return columns.length > 1 ? columns.filter((column) => column !== name) : columns;
}

export const sameColumns = (a, b) =>
  a.length === b.length && a.every((name, index) => name === b[index]);
