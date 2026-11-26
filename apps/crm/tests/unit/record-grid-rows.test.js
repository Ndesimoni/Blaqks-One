import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// The unit runner cannot parse JSX; Vite's SSR loader compiles the grid components.
const vite = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
});
after(() => vite.close());
const load = (path) => vite.ssrLoadModule(path);
const { RecordTableView } = await load('/src/features/records/RecordTableView.jsx');
const { GridSelectionBar } = await load('/src/features/records/grid/GridSelectionBar.jsx');
const { schema } = await load('/src/lib/schema.js');
const workspace = await load('/src/app/WorkspaceContext.js');
const { SessionContext } = await load('/src/app/SessionContext.js');

// Clearly fictional records; one has no name, so its first cell shows the ID.
const data = {
  Clients: [
    { client_id: 'CL-T1', full_name: 'Synthetic Client', phone: '+971 50 000 0001' },
    { client_id: 'CL-T2', full_name: '' },
  ],
};
const user = { id: 'u-test', permissions: { messaging: true }, channelAccess: {} };
const render = (element, actions = {}) =>
  renderToStaticMarkup(
    h(
      SessionContext.Provider,
      { value: { user } },
      h(
        workspace.RecordsContext.Provider,
        { value: { data, scope: 'team' } },
        h(
          workspace.ActionsContext.Provider,
          { value: { startMessage() {}, dispatchRow() {}, ...actions } },
          element,
        ),
      ),
    ),
  );
const columns = schema('Clients');
const pick = ['Full name', 'Phone'].map((name) => columns.find((f) => f.name === name));
const ticked = new Set(['CL-T1']);
const selection = {
  selected: data.Clients.filter((r) => ticked.has(r.client_id)),
  isSelected: (r) => ticked.has(r.client_id),
  toggle() {},
  togglePage() {},
  clear() {},
};
const table = (props) =>
  render(
    h(RecordTableView, {
      module: 'Clients',
      data,
      current: data.Clients,
      pick,
      columns,
      sort: { key: '', direction: 'asc' },
      setSort() {},
      setPage() {},
      dispatchRow() {},
      readOnly: false,
      gridRows: true,
      ...props,
    }),
  );

test('mockup rows: the first cell opens the record by name; no ID column or row buttons', () => {
  const html = table({});
  assert.equal(html.match(/<th /g).length, pick.length, 'no select or Open record column');
  assert.match(html, /<button type="button" class="grid-open" aria-label="Synthetic Client, open/);
  assert.match(html, /aria-label="Synthetic Client, open record CL-T1"/);
  assert.match(html, /aria-label="Open record CL-T2"[^>]*><span class="mono id-link">CL-T2</);
  assert.match(html, /class="grid-avatar" aria-hidden="true">SC</);
  assert.doesNotMatch(html, /row-link|Start message/, 'messaging moved to the selection bar');
});

test('the select column ticks rows by name and the page from the heading', () => {
  const html = table({ selection });
  assert.equal(html.match(/<th /g).length, pick.length + 1);
  assert.match(html, /aria-label="Select every row on this page"/);
  assert.match(html, /<tr class="is-selected">/);
  assert.match(html, /aria-label="Select Synthetic Client" checked=""/);
  assert.match(html, /aria-label="Select CL-T2"/);
});

test('the selection bar counts the ticked rows and offers what the person may do', () => {
  const assign = (selected) => h('button', { type: 'button' }, `Assign ${selected.length}`);
  const html = render(h(GridSelectionBar, { module: 'Clients', selection, actions: assign }));
  assert.match(html, /role="group" aria-label="Selected rows"/);
  assert.match(html, /<p class="sr-only" role="status">1 selected<\/p>/);
  assert.match(html, />Message</);
  assert.match(html, />Assign 1</);
  assert.match(html, />Clear selection</);
  const viewOnly = render(h(GridSelectionBar, { module: 'Clients', selection }), {
    readOnly: true,
  });
  assert.doesNotMatch(viewOnly, />Message</);
  const none = { ...selection, selected: [] };
  const empty = render(h(GridSelectionBar, { module: 'Contacts', selection: none }));
  assert.doesNotMatch(empty, /grid-selection/);
  assert.match(empty, /role="status"><\/p>/, 'the live region waits, empty');
});
