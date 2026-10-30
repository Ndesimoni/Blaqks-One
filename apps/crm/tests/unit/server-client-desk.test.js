import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTaskClients } from '../../src/features/server/clientDesk/clientDeskModel.js';

test('contact-only task clients exclude visible clients and search permitted fields only', () => {
  const task = [
    { client_id: 'CL-1', full_name: 'Visible', phone: null, email: null },
    { client_id: 'CL-8', full_name: 'Noor', phone: '+971500000001', email: 'noor@x.test' },
  ];
  const visible = [{ client_id: 'CL-1' }];
  assert.deepEqual(
    selectTaskClients(task, visible).map((client) => client.client_id),
    ['CL-8'],
  );
  assert.equal(selectTaskClients(task, visible, 'noor@x').length, 1);
  assert.equal(selectTaskClients(task, visible, '0001').length, 1);
  assert.equal(selectTaskClients(task, visible, 'budget').length, 0);
  assert.deepEqual(selectTaskClients(undefined, undefined), []);
});
