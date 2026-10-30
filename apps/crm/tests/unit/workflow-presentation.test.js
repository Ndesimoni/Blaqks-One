import test from 'node:test';
import assert from 'node:assert/strict';
import { schema } from '../../src/lib/schema.js';
import {
  recordCardFields,
  workflowColumns,
} from '../../src/features/records/workflowPresentation.js';

test('workflow cards retain linked records and dates instead of truncating task context', () => {
  for (const [module, names] of Object.entries(workflowColumns)) {
    const fields = names.map((name) => schema(module).find((field) => field.name === name));
    assert.ok(fields.every(Boolean), `${module}: every configured field exists in its schema`);
    const layout = recordCardFields(module, fields);
    assert.equal(layout.id, fields[0]);
    assert.ok(layout.title);
    assert.ok(layout.state, module);
    assert.equal(layout.limit, fields.length);
    assert.ok(names.includes('Client ID'));
  }
});

test('non-workflow cards retain their compact two-fact layout', () => {
  const fields = ['Client ID', 'Full name', 'Lead stage'].map((name) => ({ name }));
  const layout = recordCardFields('Clients', fields);
  assert.equal(layout.title.name, 'Full name');
  assert.equal(layout.limit, 2);
});
