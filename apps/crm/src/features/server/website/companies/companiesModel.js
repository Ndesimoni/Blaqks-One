/** Pure rules for the Super Admin's company website eligibility screen. */
export const PAGE_SIZE = 12;
export const FILTERS = ['all', 'licence', 'entitled'];

const MATCHES = {
  all: () => true,
  licence: (row) => !row.licenceVerified,
  entitled: (row) => !row.entitled,
};
const order = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Only the listed setup fields, named by the company from the workspace directory. */
export function companyRows(sites, workspaces = []) {
  const names = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  return (Array.isArray(sites) ? sites : [])
    .map((site) => ({
      workspace: site.workspace,
      name: site.name || '',
      host: site.host || '',
      active: Boolean(site.active),
      entitled: Boolean(site.entitled),
      licenceVerified: Boolean(site.licenceVerified),
      version: site.version,
      company: String(names.get(site.workspace) || site.name || '').trim(),
    }))
    .sort((a, b) => order.compare(a.company, b.company) || order.compare(a.name, b.name));
}

/** Search matches the company, website name or address; the filter narrows by flag. */
export function filterCompanies(rows, { query = '', filter = 'all' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  const matches = MATCHES[filter] || MATCHES.all;
  return rows.filter(
    (row) =>
      matches(row) &&
      (!search || `${row.company} ${row.name} ${row.host}`.toLocaleLowerCase().includes(search)),
  );
}

/** How many rows each filter keeps for the current search. */
export function filterCounts(rows, query = '') {
  return Object.fromEntries(
    FILTERS.map((filter) => [filter, filterCompanies(rows, { query, filter }).length]),
  );
}

/** The page to show: clamped when filters or saves shrink the result. */
export function pageOf(rows, page, size = PAGE_SIZE) {
  const last = Math.max(0, Math.ceil(rows.length / size) - 1);
  const current = Math.min(Math.max(0, page), last);
  return { current, items: rows.slice(current * size, (current + 1) * size) };
}

export const eligibilityForm = (row) => ({
  entitled: Boolean(row.entitled),
  licenceVerified: Boolean(row.licenceVerified),
  host: '',
});

/** Flags being turned off, in the order their warnings are shown. */
export function eligibilityImpacts(row, form) {
  const impacts = [];
  if (row.licenceVerified && !form.licenceVerified) impacts.push('licenceOff');
  if (row.entitled && !form.entitled) impacts.push('entitlementOff');
  return impacts;
}

const cleanHost = (host) => String(host || '').trim();

export const eligibilityChanged = (row, form) =>
  row.entitled !== form.entitled ||
  row.licenceVerified !== form.licenceVerified ||
  (cleanHost(form.host) !== '' && cleanHost(form.host).toLowerCase() !== row.host);

/** The request body; a blank address keeps the current one, so it is omitted. */
export function eligibilityBody(row, form) {
  const host = cleanHost(form.host);
  return {
    version: row.version,
    entitled: Boolean(form.entitled),
    licenceVerified: Boolean(form.licenceVerified),
    ...(host ? { host } : {}),
  };
}

export const isConflict = (failure) =>
  failure?.status === 409 || failure?.details?.code === 'version_conflict';
