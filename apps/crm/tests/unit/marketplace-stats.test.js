import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readMarketplaceStats } from '../../src/features/server/marketplace/marketplaceStatsModel.js';

const stats = {
  acceptedAgreements: 2,
  completedDeals: 1,
  completionRate: 50,
  averageResponseHours: 1.5,
  responseSamples: 3,
  disputesLost: null,
};
test('marketplace statistics retain aggregates and drop private identifiers', () => {
  assert.deepEqual(
    readMarketplaceStats({ ...stats, clientId: 'secret', agreementId: 'secret' }),
    stats,
  );
});
test('unknown history remains unknown, while actual zero counts stay zero', () => {
  const empty = {
    ...stats,
    acceptedAgreements: 0,
    completedDeals: 0,
    completionRate: null,
    averageResponseHours: null,
    responseSamples: 0,
  };
  assert.deepEqual(readMarketplaceStats(empty), empty);
  assert.equal(readMarketplaceStats(undefined), null);
});
test('invalid aggregate values cannot become displayed statistics', () => {
  for (const override of [
    { acceptedAgreements: -1 },
    { completedDeals: 1.5 },
    { completionRate: 101 },
    { averageResponseHours: NaN },
    { responseSamples: -1 },
    { completionRate: '50' },
  ])
    assert.equal(readMarketplaceStats({ ...stats, ...override }), null);
});
