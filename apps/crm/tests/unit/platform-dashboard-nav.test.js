import assert from 'node:assert/strict';
import test from 'node:test';
import { routeName, routePath } from '../../src/config/routes.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';
import { pageTitle } from '../../src/features/server/products/pageTitle.js';
import { locate, productEntry } from '../../src/features/server/products/productModel.js';
import { startCards } from '../../src/features/server/products/startModel.js';
import { createI18n } from '../../src/i18n/createI18n.js';
import { trendScale } from '../../src/features/server/platformDashboard/trendModel.js';

const all = { relationships: true, properties: true, schedule: true, finance: true };
const blaqksOne = { roleId: 'super-admin', managesTeam: true, permissions: all };
const admin = { roleId: 'admin', managesTeam: true, permissions: { ...all, reports: true } };
const staff = { roleId: 'staff', permissions: all };
const { t } = createI18n('en', { env: {} });

test('the platform dashboard has its own address and opens for Blaqks One only', () => {
  assert.equal(routePath('Platform dashboard'), '/platform-dashboard');
  assert.equal(routeName('/platform-dashboard'), 'Platform dashboard');
  assert.equal(canOpenSection(blaqksOne, 'Platform dashboard'), true);
  for (const user of [admin, staff, null])
    assert.equal(canOpenSection(user, 'Platform dashboard'), false);
  assert.equal(isConnectedSection('Platform dashboard', blaqksOne), true);
});

test('Platform opens on its Dashboard section, and the start card opens it first', () => {
  assert.equal(productEntry(blaqksOne, 'platform'), 'Platform dashboard');
  const place = locate(blaqksOne, 'Platform dashboard');
  assert.equal(place.product, 'platform');
  assert.equal(place.section.key, 'platformDashboard');
  assert.equal(t('products.sections.platformDashboard'), 'Dashboard');
  assert.equal(locate(admin, 'Platform dashboard'), null);
  const card = startCards.find((item) => item.key === 'platform');
  assert.equal(card.actions[0], 'Platform dashboard');
  assert.equal(pageTitle('Platform dashboard', blaqksOne, t), 'Platform dashboard');
});

test('trend axes round up to clean ticks; money axes read in compact AED', () => {
  assert.deepEqual(trendScale([0, 3, 7, null]), { max: 8, ticks: ['8', '4', '0'] });
  assert.deepEqual(trendScale([null, null]), { max: 2, ticks: ['2', '1', '0'] });
  const money = trendScale([0, 250_000_000], true);
  assert.equal(money.max, 400_000_000);
  assert.deepEqual(money.ticks, ['AED 4M', 'AED 2M', 'AED 0']);
});
