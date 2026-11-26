import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viteLoader } from './helpers/viteLoader.js';

const load = await viteLoader();
const { GridFilterBar } = await load('/src/features/records/grid/GridFilterBar.jsx');
const { GridColumnChooser } = await load('/src/features/records/grid/GridColumnChooser.jsx');
const { RecordTableView } = await load('/src/features/records/RecordTableView.jsx');
const { schema } = await load('/src/lib/schema.js');
const workspace = await load('/src/app/WorkspaceContext.js');
const { SessionContext } = await load('/src/app/SessionContext.js');

// Clearly fictional records; the workspace contexts a connected page would provide.
const data = {
  Clients: [{ client_id: 'CL-T1', full_name: 'Synthetic Client' }],
};
const render = (element) =>
  renderToStaticMarkup(
    h(
      SessionContext.Provider,
      { value: { user: { id: 'u-test' } } },
      h(
        workspace.RecordsContext.Provider,
        { value: { data, scope: 'team' } },
        h(
          workspace.ViewContext.Provider,
          { value: { page: 0, setPage() {}, query: '' } },
          h(
            workspace.ActionsContext.Provider,
            { value: { add() {}, dispatchRow() {}, startMessage() {}, can: () => true } },
            element,
          ),
        ),
      ),
    ),
  );
const bar = (props) =>
  render(
    h(GridFilterBar, {
      module: 'Contacts',
      presetLabel: 'All contacts',
      tabs: ['All', 'Landlords', 'Other contacts'],
      tab: 'All',
      onTab() {},
      query: '',
      onQuery() {},
      ...props,
    }),
  );

test('the filter bar keeps the search name and the pressed preset group browser tests use', () => {
  const html = bar({ tab: 'Landlords', presetLabel: 'Landlords' });
  assert.match(html, /<input aria-label="Search Contacts" placeholder="Filter and search"/);
  assert.match(html, /role="group" aria-label="Filter Contacts"/);
  // The first preset is the pill's default, so only the others are chips (the mockup).
  assert.equal(html.match(/class="grid-chip"/g).length, 2);
  assert.doesNotMatch(html, /class="grid-chip"[^>]*>All</);
  assert.match(html, /aria-pressed="true"[^>]*>Landlords</);
  assert.match(html, /class="grid-preset-pill" aria-hidden="true">Landlords</);
  assert.match(html, /aria-label="Clear search and filter"/);
  const unfiltered = bar({});
  assert.doesNotMatch(unfiltered, /Clear search and filter/);
  assert.match(bar({ query: 'marina' }), /Clear search and filter/);
  const single = bar({ module: 'Shortlist', tabs: ['All'], presetLabel: 'All matches' });
  assert.doesNotMatch(single, /role="group"/);
  assert.match(single, /class="grid-filterbar">/);
});

test('the column chooser is one named, collapsed icon button until opened', () => {
  const grid = { fields: [], columns: [], identity: '', isDefault: true, toggle() {} };
  const html = render(h(GridColumnChooser, { grid }));
  assert.match(html, /aria-label="Choose columns"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(html, /grid-columns-panel/);
});

test('the grid table keeps its name, headings and Open record buttons', () => {
  const columns = schema('Clients');
  const pick = ['Client ID', 'Full name'].map((name) => columns.find((f) => f.name === name));
  const html = render(
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
    }),
  );
  assert.match(html, /<table class="data-table grid-table" aria-label="Clients records">/);
  assert.equal(html.match(/<th /g).length, pick.length + 1);
  assert.match(html, /aria-label="Open record CL-T1"/);
  assert.match(html, /class="grid-avatar" aria-hidden="true">SC</);
  assert.doesNotMatch(html, /tabindex/i, 'a table that fits is not an extra tab stop');
});
