import { expect, test } from './helpers/session.js';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

test('malformed saved data is preserved through reload and can be downloaded before recovery', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('kws-crm-v1:workspace:aidah', '{unreadable existing records'),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recover your workspace' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    '{unreadable existing records',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download saved data' }).click();
  const path = testInfo.outputPath('recovery.json');
  await (await download).saveAs(path);
  expect(await readFile(path, 'utf8')).toBe('{unreadable existing records');
  await page.getByRole('button', { name: 'Retry opening workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Recover your workspace' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Replace with empty workspace' }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients.length,
      ),
    )
    .toBe(0);
});

test('invalid JSON backup and non-workbook imports leave current records intact', async ({
  page,
}) => {
  const alerts = [];
  page.on('dialog', async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  const invalid = {
    format: 'keys-with-simoni-full-backup',
    version: 2,
    data: { Properties: [], Clients: [null] },
  };
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect.poll(() => alerts.length).toBe(1);
  const zip = new JSZip();
  zip.file('not-a-workbook.txt', 'Invalid workbook');
  await page.locator('input[accept^=".xlsx"]').setInputFiles({
    name: 'invalid.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await expect.poll(() => alerts.length).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    before,
  );
  expect(alerts[0]).toContain('invalid record');
  expect(alerts[1]).toContain('missing');
});

test('real error boundaries catch render failures and allow retry without clearing stored records', async ({
  page,
}) => {
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { ErrorBoundary } = await import('/src/components/ui/ErrorBoundary.jsx');
    const container = document.createElement('div');
    document.body.appendChild(container);
    let broken = true;
    function BrokenScreen() {
      if (broken) throw Error('Simulated feature failure');
      return React.createElement('p', {}, 'Recovered feature');
    }
    window.repairTestFeature = () => {
      broken = false;
    };
    ReactDOM.createRoot(container).render(
      React.createElement(ErrorBoundary, {}, React.createElement(BrokenScreen)),
    );
  });
  await expect(
    page.getByRole('heading', { name: 'This screen could not be displayed' }),
  ).toBeVisible();
  await page.evaluate(() => window.repairTestFeature());
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Recovered feature', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    before,
  );
});
