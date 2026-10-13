import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import JSZip from 'jszip';
import { exportExcel, importExcel } from '../../src/lib/excel.js';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import { TestDOMParser } from './helpers/xml-dom.js';

const template = new URL(
  '../../public/data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx',
  import.meta.url,
);
const location = { building_project: 'Marina Gate 2', community: 'Dubai Marina', emirate: 'Dubai' };
const guard = {
  contact_id: 'CT-SG1',
  full_name: 'Example Guard',
  contact_type: 'Security guard',
  company: 'Example Security',
  phone: '+971500000001',
  ...location,
};

/** Export through the real workbook writer, capturing the download instead of saving it. */
async function exportWorkbook(data) {
  let blob;
  const previous = { document: globalThis.document, create: URL.createObjectURL };
  globalThis.document = {
    createElement: () => ({ click() {}, remove() {} }),
    body: { appendChild() {} },
  };
  URL.createObjectURL = (value) => {
    blob = value;
    return 'blob:test';
  };
  try {
    await exportExcel(data, () => {});
  } finally {
    globalThis.document = previous.document;
    URL.createObjectURL = previous.create;
  }
  assert.ok(blob, 'the workbook was exported');
  return blob;
}

const importWorkbook = async (bytes) => {
  globalThis.DOMParser = TestDOMParser;
  try {
    return await importExcel(new File([bytes], 'contacts.xlsx'));
  } finally {
    delete globalThis.DOMParser;
  }
};

test('Excel export writes the contact location columns after Record check and imports them back', async () => {
  const data = blank();
  data.Contacts = [guard, { contact_id: 'CT-L1', full_name: 'Landlord', contact_type: 'Landlord' }];
  const blob = await exportWorkbook(data);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet4.xml').async('string');
  for (const [cell, text] of [
    ['H5', 'Record check'],
    ['I5', 'Building / project'],
    ['J5', 'Community'],
    ['K5', 'Emirate'],
    ['I6', 'Marina Gate 2'],
    ['K6', 'Dubai'],
  ])
    assert.match(sheet, new RegExp(`<c r="${cell}" t="inlineStr"><is><t>${text}</t>`));
  const imported = await importWorkbook(await blob.arrayBuffer());
  assert.deepEqual(imported.Contacts, data.Contacts);
  assert.deepEqual(imported.Clients, []);
});

test('workbooks without the contact location columns still import every existing contact field', async () => {
  const data = blank();
  data.Contacts = [guard];
  const zip = await JSZip.loadAsync(await (await exportWorkbook(data)).arrayBuffer());
  const path = 'xl/worksheets/sheet4.xml';
  const older = (await zip.file(path).async('string')).replace(/<c r="[IJK]\d+"[\s\S]*?<\/c>/g, '');
  assert.doesNotMatch(older, /Building \/ project/);
  zip.file(path, older);
  const imported = await importWorkbook(await zip.generateAsync({ type: 'uint8array' }));
  const { building_project, community, emirate, ...existing } = guard;
  assert.deepEqual(
    [building_project, community, emirate],
    ['Marina Gate 2', 'Dubai Marina', 'Dubai'],
  );
  assert.deepEqual(imported.Contacts, [existing]);
});

test('the original workbook template with eight Contacts columns imports a contact row', async () => {
  const zip = await JSZip.loadAsync(await readFile(template));
  const path = 'xl/worksheets/sheet4.xml';
  const cells = [
    ['A', 'CT-T1'],
    ['B', 'Template contact'],
    ['C', 'Building manager'],
    ['D', 'Example Towers'],
  ]
    .map(([col, value]) => `<x:c r="${col}6" t="inlineStr"><x:is><x:t>${value}</x:t></x:is></x:c>`)
    .join('');
  const xml = await zip.file(path).async('string');
  zip.file(
    path,
    xml.replace(/<x:row\b[^>]*r="6"[^>]*>[\s\S]*?<\/x:row>/, `<x:row r="6">${cells}</x:row>`),
  );
  const imported = await importWorkbook(await zip.generateAsync({ type: 'uint8array' }));
  assert.deepEqual(imported.Contacts, [
    {
      contact_id: 'CT-T1',
      full_name: 'Template contact',
      contact_type: 'Building manager',
      company: 'Example Towers',
    },
  ]);
});

test('full JSON backups keep contact location fields and accept contacts without them', () => {
  const data = blank();
  data.Contacts = [guard, { contact_id: 'CT-OLD', full_name: 'Older contact' }];
  const restored = parseFullBackup(JSON.stringify(createFullBackup(data, '2026-10-13T00:00:00Z')));
  assert.deepEqual(restored.Contacts, data.Contacts);
  const invalid = blank();
  invalid.Contacts = [{ ...guard, community: { name: 'Dubai Marina' } }];
  assert.throws(
    () => parseFullBackup(JSON.stringify(createFullBackup(invalid))),
    /Contacts: Community must be a text or number value/,
  );
});
