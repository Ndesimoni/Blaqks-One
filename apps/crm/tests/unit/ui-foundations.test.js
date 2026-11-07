import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// The unit runner cannot parse JSX; Vite's existing SSR loader compiles the primitives.
const vite = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
});
const render = (Component, props = {}, children) =>
  renderToStaticMarkup(createElement(Component, props, children));
const range = (html) => html.match(/Showing [^<]+/)[0];
const { Button } = await vite.ssrLoadModule('/src/components/ui/Button.jsx');
const { Badge } = await vite.ssrLoadModule('/src/components/ui/Badge.jsx');
const { Pagination } = await vite.ssrLoadModule('/src/components/ui/Pagination.jsx');
const { Empty } = await vite.ssrLoadModule('/src/components/ui/Empty.jsx');
after(() => vite.close());

test('Button forwards caller attributes, variant and disabled state', () => {
  const html = render(
    Button,
    {
      variant: 'light',
      className: 'wide',
      type: 'submit',
      disabled: true,
      'data-testid': 'save',
      'aria-label': 'Save client',
    },
    'Save',
  );
  assert.match(html, /class="btn btn-light wide"/);
  assert.match(html, /type="submit"/);
  assert.match(html, /data-testid="save"/);
  assert.match(html, /aria-label="Save client"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /<span>Save<\/span>/);
  assert.match(render(Button, {}, 'Plain'), /btn btn-primary/);
});

test('Button keeps a labelled icon decorative and omits an empty title', () => {
  const html = render(Button, { icon: 'plus' }, 'Add client');
  assert.match(html, /<svg aria-hidden="true"/);
  assert.doesNotMatch(html, /title=/);
  assert.match(render(Button, { title: 'Add client' }, 'Add client'), /title="Add client"/);
});

test('Badge derives tones from status text and honours explicit tone precedence', () => {
  assert.match(render(Badge, {}, 'Completed'), /badge badge-green/);
  assert.match(render(Badge, {}, 'Overdue'), /badge badge-red/);
  assert.match(render(Badge, {}, 'Pending'), /badge badge-amber/);
  assert.match(render(Badge, {}, 'Archived'), /badge badge-slate/);
  assert.match(render(Badge, { tone: 'slate' }, 'Completed'), /badge badge-slate/);
  assert.match(render(Badge, { tone: 'amber' }, 'Overdue'), /badge badge-amber/);
});

test('Badge keeps text as the meaning, hides the dot and falls back', () => {
  assert.match(
    render(Badge, {}, 'Paid'),
    /<span class="badge-dot" aria-hidden="true"><\/span>Paid/,
  );
  assert.match(render(Badge, {}, ''), /—/);
});

test('Pagination reports zero, one and many pages with a label fallback', () => {
  const none = render(Pagination, { total: 0, page: 0, itemLabel: 'clients', onChange() {} });
  assert.match(none, /<nav class="collection-pagination" aria-label="clients pagination"/);
  assert.equal(range(none), 'Showing 0–0 of 0 clients');
  assert.doesNotMatch(none, /class="pager"/);
  const one = render(Pagination, { total: 12, page: 0, onChange() {} });
  assert.equal(range(one), 'Showing 1–12 of 12 records');
  assert.doesNotMatch(one, /class="pager"/);
  const many = render(Pagination, { total: 13, page: 0, label: 'Client pages', onChange() {} });
  assert.match(many, /aria-label="Client pages"/);
  assert.equal(range(many), 'Showing 1–12 of 13 records');
  assert.match(many, /Page 1 of 2/);
  assert.match(many, /disabled=""/);
});

test('Pagination clamps out-of-range pages and keeps the table pager readable', () => {
  const last = render(Pagination, { total: 13, page: 1, onChange() {} });
  assert.equal(range(last), 'Showing 13–13 of 13 records');
  const clamped = render(Pagination, { total: 25, page: 9, pageSize: 12, onChange() {} });
  assert.equal(range(clamped), 'Showing 25–25 of 25 records');
  assert.match(clamped, /Page 3 of 3/);
  const table = render(Pagination, { total: 5, page: 0, variant: 'table', onChange() {} });
  assert.match(table, /class="table-footer"/);
  assert.match(table, /class="pager"/);
  assert.match(table, /<span class="sr-only">Page 1 of 1<\/span>/);
  assert.match(table, /<span aria-hidden="true">1 \/ 1<\/span>/);
});

test('Empty keeps truthful defaults and renders a caller-supplied action', () => {
  const plain = render(Empty);
  assert.match(plain, /<h3>Nothing here yet<\/h3>/);
  assert.match(plain, /No records to show here\./);
  assert.doesNotMatch(plain, /Create your first record/);
  const action = createElement('button', null, 'Add client');
  const custom = render(Empty, {
    title: 'No clients found',
    detail: 'Try another search.',
    icon: 'users',
    action,
  });
  assert.match(custom, /<h3>No clients found<\/h3>/);
  assert.match(custom, /Try another search\./);
  assert.match(custom, /<button>Add client<\/button>/);
});
