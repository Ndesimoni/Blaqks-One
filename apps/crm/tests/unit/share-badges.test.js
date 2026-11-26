import test from 'node:test';
import assert from 'node:assert/strict';
import { announceSharesChanged, waitingSources } from '../../src/features/server/waitingCounts.js';

// Record sharing R1: Leads, Clients, Properties and Contacts badges count shares waiting.
test('the four record badges share one waiting read and count their own collection', async () => {
  let calls = 0;
  const api = {
    sharesWaiting: async (workspace) => {
      calls += 1;
      assert.equal(workspace, 'ws-1');
      return { Clients: 2, Properties: 1, Contacts: -3 };
    },
  };
  announceSharesChanged();
  const read = (name) => waitingSources[name].read(api, 'ws-1');
  const counts = await Promise.all(['Leads', 'Clients', 'Properties', 'Contacts'].map(read));
  assert.deepEqual(counts, [2, 2, 1, 0], 'invalid counts read as zero');
  assert.equal(calls, 1, 'one request serves every badge');
  announceSharesChanged();
  assert.equal(await read('Clients'), 2);
  assert.equal(calls, 2, 'a share change reads again');
  assert.equal(waitingSources.Contacts.labelKey, 'recordShares.nav.Contacts');
  assert.equal(waitingSources.Leads.labelKey, 'recordShares.nav.Clients');
});

test('a failed waiting read is not reused', async () => {
  let calls = 0;
  const api = {
    sharesWaiting: async () => {
      calls += 1;
      if (calls === 1) throw new Error('offline');
      return { Properties: 4 };
    },
  };
  announceSharesChanged();
  await assert.rejects(waitingSources.Properties.read(api, 'ws-2'), /offline/);
  assert.equal(await waitingSources.Properties.read(api, 'ws-2'), 4);
});
