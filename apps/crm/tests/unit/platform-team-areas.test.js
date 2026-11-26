import assert from 'node:assert/strict';
import test from 'node:test';
import { canOpenSection } from '../../src/features/server/access.js';
import { hasPlatformArea } from '../../src/features/server/platformAccess.js';
import {
  PRESETS,
  presetFor,
  setLevel,
  staffError,
} from '../../src/features/server/platformTeam/teamAreasModel.js';

const staff = (platformAccess) => ({ roleId: 'platform', platformAccess });

test('platform staff open the pages of their areas, never a company page (BO1b)', () => {
  const analyst = staff(PRESETS.analyst);
  assert.equal(canOpenSection(analyst, 'Platform dashboard'), true);
  for (const route of ['Workspaces', 'Team & access', 'Blaqks One team', 'Team activity'])
    assert.equal(canOpenSection(analyst, route), false, route);
  const sales = staff(PRESETS.sales);
  assert.equal(canOpenSection(sales, 'Workspaces'), true);
  assert.equal(hasPlatformArea(sales, 'companies', 'manage'), false);
  assert.equal(hasPlatformArea(sales, 'clients', 'manage'), true);
  const manager = staff(PRESETS.manager);
  assert.equal(canOpenSection(manager, 'Team & access'), true);
  assert.equal(canOpenSection(manager, 'Blaqks One team'), false);
  for (const route of ['Clients', 'Deals', 'Inbox', 'Dashboard', 'Website'])
    assert.equal(canOpenSection(manager, route), false, route);
  const owner = { roleId: 'super-admin' };
  assert.equal(canOpenSection(owner, 'Blaqks One team'), true);
  assert.equal(hasPlatformArea(owner, 'companies', 'manage'), true);
  assert.equal(
    hasPlatformArea({ roleId: 'admin', platformAccess: PRESETS.manager }, 'dashboard'),
    false,
  );
});

test('View reads and Manage changes; positions fill the levels; the form checks itself', () => {
  const viewer = staff({ marketplace: 'view' });
  assert.equal(hasPlatformArea(viewer, 'marketplace'), true);
  assert.equal(hasPlatformArea(viewer, 'marketplace', 'manage'), false);
  assert.equal(presetFor({ companies: 'view', help_requests: 'manage' }), 'support');
  assert.equal(presetFor({ companies: 'manage' }), 'custom');
  assert.deepEqual(setLevel({ companies: 'view' }, 'companies', 'manage'), { companies: 'manage' });
  assert.deepEqual(setLevel({ companies: 'view' }, 'companies', 'off'), {});
  // The dashboard has no Manage level, so asking for it changes nothing.
  assert.deepEqual(setLevel({}, 'dashboard', 'manage'), {});
  const form = { name: 'Reem', email: 'reem@example.test', phone: '+971501234567', access: {} };
  assert.equal(staffError(form, true), 'platformTeam.errorAreas');
  const sales = { ...form, access: PRESETS.sales };
  assert.equal(staffError({ ...sales, phone: '050' }, true), 'platformTeam.errorPhone');
  assert.equal(staffError(sales, true), '');
});
