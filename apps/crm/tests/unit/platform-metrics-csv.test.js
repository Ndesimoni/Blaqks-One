import assert from 'node:assert/strict';
import test from 'node:test';
import { createI18n } from '../../src/i18n/createI18n.js';
import {
  metricsCsv,
  metricsCsvName,
} from '../../src/features/server/platformDashboard/metricsCsv.js';
import {
  compactMoney,
  csvValue,
  figureText,
} from '../../src/features/server/platformDashboard/metricsFormat.js';
import { sampleMetrics } from './platform-metrics-fixture.js';

const i18n = createI18n('en', { env: {} });
const { t } = i18n;

test('figures read as counts, AED from whole fils, days and live flags', () => {
  assert.equal(figureText('count', 1234, i18n), '1,234');
  assert.equal(figureText('count', 0, i18n), '0');
  assert.equal(figureText('money', 1_234_567_850, i18n), 'AED 12,345,678.50');
  assert.equal(figureText('money', 0, i18n), 'AED 0.00');
  assert.equal(figureText('days', 18.5, i18n), '18.5 days');
  assert.equal(figureText('days', 1, i18n), '1 day');
  assert.equal(figureText('flag', true, i18n), 'Live');
  assert.equal(figureText('flag', 0, i18n), 'Not live');
});

test('an untracked figure is null on screen and says so in the CSV, never zero', () => {
  for (const kind of ['count', 'money', 'days', 'flag']) {
    assert.equal(figureText(kind, null, i18n), null);
    assert.equal(csvValue(kind, null, t), 'Not tracked yet');
  }
  assert.equal(compactMoney(null), null);
  assert.equal(compactMoney(1_234_567_850), 'AED 12.3M');
  assert.equal(csvValue('money', 1_234_567_850, t), '12345678.50');
  assert.equal(csvValue('count', 0, t), '0');
});

test('the CSV file name carries the period and the Dubai day', () => {
  assert.equal(metricsCsvName('12m', '2026-11-05'), 'Blaqks_One_metrics_12m_2026-11-05.csv');
});

test('the CSV lists the period, every figure, the trends and company usage', () => {
  const lines = metricsCsv(sampleMetrics(), t).split('\n');
  assert.equal(lines[0], '"Blaqks One platform figures"');
  assert.equal(lines[1], '"Period","Last 30 days","2026-10-07","2026-11-05"');
  assert.equal(lines[2], '"Generated","2026-11-05T08:30:00Z"');
  assert.ok(lines.includes('"Section","Figure","Covers","Value","Unit"'));
  assert.ok(lines.includes('"Websites","Websites live","To date","6",""'));
  assert.ok(lines.includes('"Websites","General site","To date","Live",""'));
  assert.ok(
    lines.includes(
      '"Websites","Value sold through the websites","Last 30 days","1200000.00","AED"',
    ),
  );
  assert.ok(lines.includes('"Deals & money","Earned deal value","To date","12345678.50","AED"'));
  assert.ok(
    lines.includes('"Growth","Median time to a first earned deal","To date","18.5","days"'),
  );
  assert.ok(
    lines.includes(
      '"Users outside the companies","Website visitors","To date","Not tracked yet",""',
    ),
  );
  const month = lines.findIndex((line) => line.startsWith('"Month"'));
  assert.equal(
    lines[month],
    '"Month","New companies","New users","Monthly active users","Records added",' +
      '"Website enquiries","Deals earned","Deals earned value (AED)","Agreements between brokers"',
  );
  assert.equal(lines[month + 1], '"2025-12","0","2","Not tracked yet","40","5","0","0.00","0"');
  assert.equal(lines[month + 12].split(',')[0], '"2026-11"');
  assert.equal(lines[month + 13], '');
});

test('company rows carry usage only, and names cannot run as spreadsheet formulas', () => {
  const lines = metricsCsv(sampleMetrics(), t).split('\n');
  const head = lines.findIndex((line) => line.startsWith('"Company"'));
  assert.equal(
    lines[head],
    '"Company","Admin","Joined","Status","Seats used","Seat limit",' +
      '"Active users (30 days)","Last active","Records"',
  );
  assert.equal(
    lines[head + 1],
    '"Synthetic Palm Realty","Fictional Admin","2026-03-02","Active","4","5","3",' +
      '"2026-11-04T16:00:00Z","120"',
  );
  assert.equal(
    lines[head + 2],
    '"\'=HYPERLINK(""x"")","","2026-10-30","Archived","1","No limit","0","","0"',
  );
  assert.equal(lines.length, head + 3);
  assert.doesNotMatch(lines.slice(head).join('\n'), /AED|\d+\.\d\d/);
});
