import assert from 'node:assert/strict';
import test from 'node:test';
import { MODS, schema } from '../../src/lib/schema.js';
import { errorSectionIndex, recordFormSections } from '../../src/features/records/formSections.js';
import { validateRecord, validateRecordSection } from '../../src/features/records/validation.js';
import { localScheduleFields } from '../../src/config/calendar.js';

test('form sections retain every editable workbook field exactly once and keep the ID first', () => {
  const longForms = [
    'Clients',
    'Properties',
    'Deals',
    'Interaction log',
    'Client care',
    'Follow-ups',
    'Viewings',
  ];
  for (const module of Object.keys(MODS)) {
    const editable = schema(module).filter((field) => !field.calculated);
    const sections = recordFormSections(module);
    const fields = sections.flatMap((section) => section.fields);
    assert.deepEqual(
      fields.map((field) => field.key).sort(),
      [...editable, ...localScheduleFields(module)].map((field) => field.key).sort(),
    );
    assert.equal(new Set(fields.map((field) => field.key)).size, fields.length);
    assert.equal(sections[0].fields[0].key, editable[0].key);
    assert.equal(sections.length > 1, longForms.includes(module));
  }
  assert.equal(recordFormSections('Properties').filter((section) => section.media).length, 1);
});

test('section validation checks duplicate IDs and current fields while deferring errors from later sections', () => {
  const sections = recordFormSections('Clients');
  const form = { client_id: 'CL-1', email: 'invalid', maximum_budget_aed: -1 };
  const errors = validateRecordSection(
    'Clients',
    form,
    [{ client_id: 'CL-1' }],
    null,
    sections[0].fields,
  );
  assert.ok(errors.client_id);
  assert.ok(errors.email);
  assert.equal(errors.maximum_budget_aed, undefined);
  assert.equal(errorSectionIndex(sections, errors), 0);
  const later = validateRecordSection('Clients', form, [], null, sections[2].fields);
  assert.ok(later.maximum_budget_aed);
  assert.equal(errorSectionIndex(sections, later), 2);
});

test('budget bounds are checked together and final errors locate their editable section', () => {
  const sections = recordFormSections('Clients');
  const form = { client_id: 'CL-1', minimum_budget_aed: 500, maximum_budget_aed: 100 };
  assert.deepEqual(validateRecordSection('Clients', form, [], null, sections[0].fields), {});
  const errors = validateRecordSection('Clients', form, [], null, sections[2].fields);
  assert.ok(errors.maximum_budget_aed);
  assert.equal(errorSectionIndex(sections, errors), 2);
  assert.equal(errorSectionIndex(sections, {}), -1);
  assert.equal(errorSectionIndex(recordFormSections('Properties'), { listing_url: 'Invalid' }), 4);
});

test('local scheduling hides integration controls and retained invitation settings do not block edits', () => {
  const sections = recordFormSections('Follow-ups');
  const schedule = sections.find((section) => section.id === 'schedule');
  assert.equal(schedule.title, 'Scheduling');
  const keys = schedule.fields.map((field) => field.key);
  assert.ok(keys.includes('due_date'));
  assert.ok(keys.includes('calendar_start'));
  for (const key of ['calendar_enabled', 'calendar_invite', 'calendar_reminder'])
    assert.equal(keys.includes(key), false);
  const record = {
    activity_id: 'FU-LOCAL',
    due_date: '2026-10-09',
    calendar_start: '2026-10-09T10:30',
    calendar_activity: 'Meeting',
    calendar_duration: '45',
    calendar_enabled: 'Yes',
    calendar_invite: 'Yes',
    calendar_reminder: 'legacy value',
  };
  const before = structuredClone(record);
  assert.deepEqual(validateRecord('Follow-ups', record), {});
  assert.ok(validateRecord('Follow-ups', { ...record, calendar_duration: '0' }).calendar_duration);
  assert.deepEqual(record, before);
});
