import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viteLoader } from './helpers/viteLoader.js';

const load = await viteLoader();
const { RecordFeed } = await load('/src/features/records/feed/RecordFeed.jsx');
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

test('the Interaction log feed groups conversations by day with their titles and actions', () => {
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
  // The mockup's titles name who and how; without a client the topic leads.
  assert.match(html, /class="feed-title">Conversation with Synthetic Client</);
  assert.match(html, /class="feed-title">Viewing requirements</);
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
