import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import { exportWorkbook, importWorkbook } from './helpers/workbook.js';

const place = {
  address: 'Unit 1204, Marina Gate Tower 2',
  map_link: 'https://maps.google.com/?q=Marina%20Gate%202',
};
const listing = {
  property_id: 'PR-L1',
  listing_title: 'Marina Gate apartment',
  contact_id: 'CT-L1',
  building_project: 'Marina Gate 2',
  viewing_instructions: 'Collect keys at reception',
  ...place,
};
const sheet = 'xl/worksheets/sheet5.xml';

test('Excel export writes property Address and Map link in AN-AO and imports them back', async () => {
  const data = blank();
  data.Properties = [listing, { property_id: 'PR-L2', listing_title: 'No location yet' }];
  const blob = await exportWorkbook(data);
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file(sheet).async('string');
  for (const [cell, text] of [
    ['AM5', 'Viewing instructions'],
    ['AN5', 'Address'],
    ['AO5', 'Map link'],
    ['AN6', place.address],
  ])
    assert.match(xml, new RegExp(`<c r="${cell}" t="inlineStr"><is><t>${text}</t>`));
  const imported = await importWorkbook(await blob.arrayBuffer());
  const [first, second] = imported.Properties;
  assert.equal(first.address, place.address);
  assert.equal(first.map_link, place.map_link);
  assert.equal(first.viewing_instructions, listing.viewing_instructions);
  assert.equal(second.address, undefined);
});

test('workbooks without the property AN-AO columns still import every earlier field', async () => {
  const data = blank();
  data.Properties = [listing];
  const zip = await JSZip.loadAsync(await (await exportWorkbook(data)).arrayBuffer());
  const xml = await zip.file(sheet).async('string');
  const older = xml.replace(/<c r="A[NO]\d+"[\s\S]*?<\/c>/g, '');
  assert.doesNotMatch(older, /Map link|Marina Gate Tower 2/);
  zip.file(sheet, older);
  const imported = await importWorkbook(await zip.generateAsync({ type: 'uint8array' }));
  const [property] = imported.Properties;
  assert.equal(property.address, undefined);
  assert.equal(property.map_link, undefined);
  const withNew = await importWorkbook(await (await exportWorkbook(data)).arrayBuffer());
  const { address, map_link, ...earlier } = withNew.Properties[0];
  assert.deepEqual({ address, map_link }, place);
  assert.deepEqual(property, earlier);
});

test('full JSON backups keep property location fields and accept properties without them', () => {
  const data = blank();
  data.Properties = [listing, { property_id: 'PR-OLD', listing_title: 'Older listing' }];
  const restored = parseFullBackup(JSON.stringify(createFullBackup(data, '2026-10-14T00:00:00Z')));
  assert.deepEqual(restored.Properties[0].address, place.address);
  assert.deepEqual(restored.Properties[0].map_link, place.map_link);
  assert.equal(restored.Properties[1].address, undefined);
  const invalid = blank();
  invalid.Properties = [{ ...listing, address: { line: 'Tower 2' } }];
  assert.throws(
    () => parseFullBackup(JSON.stringify(createFullBackup(invalid))),
    /Properties: Address must be a text or number value/,
  );
});
