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
  address: 'Tower 2 lobby, Marina Gate',
  map_link: 'https://maps.google.com/?q=Marina%20Gate%202',
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
    ['L5', 'Address'],
    ['M5', 'Map link'],
    ['I6', 'Marina Gate 2'],
    ['K6', 'Dubai'],
    ['L6', 'Tower 2 lobby, Marina Gate'],
  ])
    assert.match(sheet, new RegExp(`<c r="${cell}" t="inlineStr"><is><t>${text}</t>`));
  const imported = await importWorkbook(await blob.arrayBuffer());
  assert.deepEqual(imported.Contacts, data.Contacts);
  assert.deepEqual(imported.Clients, []);
});

test('workbooks without columns I-M or only L-M still import every earlier contact field', async () => {
  const data = blank();
  data.Contacts = [guard];
  const zip = await JSZip.loadAsync(await (await exportWorkbook(data)).arrayBuffer());
  const path = 'xl/worksheets/sheet4.xml';
  const xml = await zip.file(path).async('string');
  const without = async (letters, header) => {
    const older = xml.replace(new RegExp(`<c r="[${letters}]\\d+"[\\s\\S]*?<\\/c>`, 'g'), '');
    assert.doesNotMatch(older, header);
    zip.file(path, older);
    return (await importWorkbook(await zip.generateAsync({ type: 'uint8array' }))).Contacts;
  };
  const { building_project, community, emirate, address, map_link, ...existing } = guard;
  assert.deepEqual([address, map_link].map(Boolean), [true, true]);
  assert.deepEqual(await without('I-M', /Building \/ project|Map link/), [existing]);
  assert.deepEqual(await without('LM', /Address|Map link/), [{ ...existing, ...location }]);
  assert.deepEqual({ building_project, community, emirate }, location);
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
