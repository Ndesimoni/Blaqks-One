import { expect, test } from './helpers/session.js';
import JSZip from 'jszip';
import { schema } from '../../src/lib/schema.js';

test('original prefixed Excel template parses and imports rich text, numeric zero and Excel dates', async ({
  page,
}) => {
  await page.goto('/');
  const empty = await page.evaluate(async () => {
    const { importExcel } = await import('/src/lib/excel.js');
    const response = await fetch('/data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx');
    return importExcel(new File([await response.arrayBuffer()], 'template.xlsx'));
  });
  expect(Object.keys(empty)).toHaveLength(11);
  expect(Object.values(empty).every((rows) => rows.length === 0)).toBe(true);
  const workbook = await page.request.get('/data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx');
  const zip = await JSZip.loadAsync(await workbook.body());
  const col = (module, field) => schema(module).find((value) => value.key === field).col;
  const cells = [
    `<x:c r="A6" t="inlineStr"><x:is><x:t>CL-TEMPLATE</x:t></x:is></x:c>`,
    `<x:c r="B6" t="inlineStr"><x:is><x:r><x:t>Template </x:t></x:r><x:r><x:t>Client</x:t></x:r></x:is></x:c>`,
    `<x:c r="${col('Clients', 'maximum_budget_aed')}6"><x:v>0</x:v></x:c>`,
    `<x:c r="${col('Clients', 'date_added')}6"><x:v>46031</x:v></x:c>`,
  ].join('');
  const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
  zip.file(
    'xl/worksheets/sheet3.xml',
    xml.replace(/<x:row\b[^>]*r="6"[^>]*>[\s\S]*?<\/x:row>/, `<x:row r="6">${cells}</x:row>`),
  );
  const messages = [];
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.locator('input[accept^=".xlsx"]').setInputFiles({
    name: 'original-template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await expect(page.locator('.toast')).toContainText('Imported 1 records from Excel');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients[0],
  );
  expect(saved.full_name).toBe('Template Client');
  expect(saved.maximum_budget_aed).toBe(0);
  expect(saved.date_added).toBe(
    new Date(Date.UTC(1899, 11, 30) + 46031 * 86400000).toISOString().slice(0, 10),
  );
  expect(messages).toHaveLength(1);
});
