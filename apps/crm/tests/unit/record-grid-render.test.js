import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// The unit runner cannot parse JSX; Vite's SSR loader compiles the grid and feed components.
const vite = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
});
after(() => vite.close());
const load = (path) => vite.ssrLoadModule(path);
const { GridFilterBar } = await load('/src/features/records/grid/GridFilterBar.jsx');
const { GridColumnChooser } = await load('/src/features/records/grid/GridColumnChooser.jsx');
const { RecordTableView } = await load('/src/features/records/RecordTableView.jsx');
const { RecordFeed } = await load('/src/features/records/feed/RecordFeed.jsx');
const { schema } = await load('/src/lib/schema.js');
const workspace = await load('/src/app/WorkspaceContext.js');
const { SessionContext } = await load('/src/app/SessionContext.js');

// Clearly fictional records; the workspace contexts a connected page would provide.
const data = {
  Clients: [{ client_id: 'CL-T1', full_name: 'Synthetic Client' }],
  Properties: [{ property_id: 'PR-T1', listing_title: 'Synthetic listing' }],
  'Interaction log': [
    { log_id: 'LG-T1', contacted_on_uae_time: '2020-01-01 10:00', client_id: 'CL-T1' },
    {
      log_id: 'LG-T2',
      contacted_on_uae_time: '2020-01-03 09:40',
      channel: 'WhatsApp',
      direction: 'Inbound',
      conversation_topic: 'Viewing requirements',
      property_id_optional: 'PR-T1',
      next_action: 'Send shortlist',
      action_due: '2020-01-04',
      action_status: 'Open',
    },
  ],
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
  assert.equal(html.match(/class="grid-chip"/g).length, 3);
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

test('the Interaction log feed groups conversations by day with their links and actions', () => {
  const html = render(h(RecordFeed, { module: 'Interaction log', arr: data['Interaction log'] }));
  assert.match(html, /<section class="feed-days" aria-label="Interaction log records">/);
  const days = [...html.matchAll(/<h2 class="feed-day-title">([^<]+)</g)].map((m) => m[1]);
  assert.equal(days.length, 2);
  assert.ok(days[0].includes('3 Jan 2020') && days[1].includes('1 Jan 2020'), days.join(' | '));
  assert.ok(html.indexOf('LG-T2') < html.indexOf('LG-T1'), 'newest conversation first');
  for (const text of ['Viewing requirements', 'Synthetic listing', 'Synthetic Client'])
    assert.ok(html.includes(text), text);
  assert.match(html, /<time dateTime="2020-01-03T09:40">09:40<\/time>/i);
  assert.match(html, /Next: Send shortlist/);
  assert.match(html, /Action due 04 Jan 2020/);
  assert.match(html, />Conversation</, 'a conversation without a topic keeps a title');
  assert.match(html, /aria-label="Open record LG-T1"/);
  assert.match(html, /aria-label="Interaction log pages"/);
  assert.match(html, /Total: <strong>2<\/strong>/);
});

test('an empty feed explains itself and keeps the footer', () => {
  const html = render(h(RecordFeed, { module: 'Interaction log', arr: [] }));
  assert.doesNotMatch(html, /feed-days/);
  assert.match(html, /No matching records/);
  assert.match(html, /Total: <strong>0<\/strong>/);
});
