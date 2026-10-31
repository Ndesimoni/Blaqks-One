import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entryAmount,
  entryAmountMessage,
  entryDateError,
  futureDateMessage,
  paymentDraft,
  receiptLinkError,
  receiptMessage,
  validatePayment,
} from '../../src/features/server/finance/entryDraft.js';
import { expenseDraft, validateExpense } from '../../src/features/server/finance/expenseDraft.js';

const today = '2026-10-15';

test('entry amounts are whole fils from AED 0.01 to AED 10bn, never rounded', () => {
  assert.deepEqual(entryAmount('10,000.5'), { value: 1_000_050, error: '' });
  assert.deepEqual(entryAmount('0.01'), { value: 1, error: '' });
  assert.equal(entryAmount('0').error, entryAmountMessage);
  assert.equal(entryAmount('10000000000.01').error, entryAmountMessage);
  assert.deepEqual(entryAmount('10000000000'), { value: 1_000_000_000_000, error: '' });
  assert.match(entryAmount('1.005').error, /two decimal places/);
  assert.equal(entryAmount('').error, 'Enter an amount.');
});

test('dates must be real days up to today in Asia/Dubai', () => {
  assert.equal(entryDateError(today, today), '');
  assert.equal(entryDateError('2026-10-16', today), futureDateMessage);
  assert.match(entryDateError('2026-02-30', today), /valid date/);
  assert.match(entryDateError('', today), /valid date/);
});

test('receipt links are optional and https only', () => {
  assert.equal(receiptLinkError(''), '');
  assert.equal(receiptLinkError('https://files.example.test/r.pdf'), '');
  for (const link of ['http://files.example.test/r.pdf', 'javascript:alert(1)', 'not a link'])
    assert.equal(receiptLinkError(link), receiptMessage, link);
  assert.equal(receiptLinkError(`https://x.test/${'a'.repeat(2050)}`), receiptMessage);
});

test('payment bodies send exact keys; the deal only on create; blanks become null', () => {
  const draft = {
    dealId: 'DL-001',
    receiptDate: today,
    amount: '1,234.50',
    reference: ' ',
    notes: 'n',
  };
  assert.deepEqual(validatePayment(draft, { today, creating: true }).body, {
    dealId: 'DL-001',
    receiptDate: today,
    amountFils: 123_450,
    reference: null,
    notes: 'n',
  });
  const edit = validatePayment(draft, { today, creating: false }).body;
  assert.deepEqual(Object.keys(edit), ['receiptDate', 'amountFils', 'reference', 'notes']);
  const bad = validatePayment({ ...draft, dealId: '', amount: '0' }, { today, creating: true });
  assert.equal(bad.body, null);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['amount', 'dealId']);
  const long = validatePayment({ ...draft, reference: 'r'.repeat(201) }, { today, creating: true });
  assert.match(long.errors.reference, /200 characters/);
  const view = { dealId: 'DL-1', receiptDate: today, amountFils: 5, reference: null, notes: null };
  assert.deepEqual(paymentDraft(view), {
    dealId: 'DL-1',
    receiptDate: today,
    amount: '0.05',
    reference: '',
    notes: '',
  });
});

test('only the Admin sends incurredBy; staff bodies never carry it', () => {
  const draft = { datePaid: today, amount: '1500', category: 'Marketing', incurredBy: 'u-2' };
  const staff = validateExpense(draft, { today, manage: false }).body;
  assert.equal('incurredBy' in staff, false);
  assert.deepEqual(staff, {
    datePaid: today,
    amountFils: 150_000,
    category: 'Marketing',
    supplier: null,
    campaignReference: null,
    propertyId: null,
    receiptUrl: null,
    notes: null,
  });
  assert.equal(validateExpense(draft, { today, manage: true }).body.incurredBy, 'u-2');
  const self = validateExpense({ ...draft, incurredBy: '' }, { today, manage: true }).body;
  assert.equal(self.incurredBy, null);
  const bad = validateExpense({ ...draft, receiptUrl: 'http://x.test' }, { today, manage: true });
  assert.deepEqual(bad.errors, { receiptUrl: receiptMessage });
  const view = {
    datePaid: today,
    amountFils: 150_000,
    category: null,
    supplier: 'S',
    campaignReference: null,
    propertyId: 'PR-1',
    receiptUrl: null,
    notes: null,
    incurredBy: { id: 'u-3', name: 'Agent' },
  };
  assert.equal(expenseDraft(view).incurredBy, 'u-3');
  assert.equal(expenseDraft(view).amount, '1500.00');
});
