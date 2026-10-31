import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aboutLabel,
  apiPage,
  assigneeLabel,
  contactParts,
  enquiryInstant,
  listingTitles,
  preference,
  readEnquiries,
  senderName,
  siteKind,
  viewPage,
} from '../../src/features/server/website/enquiries/enquiriesModel.js';
import { createFormatters } from '../../src/i18n/format.js';

const enquiry = (extras = {}) => ({
  id: 'enq-1',
  siteId: 'site-company',
  listingId: 'pub-1',
  assigneeId: 'member-1',
  leadId: 'lead-1',
  enquiry: {
    name: ' Synthetic Visitor ',
    email: 'visitor@example.test',
    phone: '+971500000000',
    message: 'A synthetic question.',
    contactPreference: 'whatsapp',
  },
  createdAt: '2026-10-30 08:15:02.123456+00',
  ...extras,
});

test('pages convert between the 0-based pager and the 1-based API', () => {
  assert.equal(apiPage(0), 1);
  assert.equal(apiPage(3), 4);
  assert.equal(apiPage(-2), 1);
  assert.equal(viewPage(1), 0);
  assert.equal(viewPage(5), 4);
  assert.equal(viewPage(undefined), 0);
  const page = readEnquiries({ data: [enquiry()], pagination: { total: 51, page: 2 } });
  assert.deepEqual(page, { rows: [enquiry()], total: 51, page: 1 });
  assert.deepEqual(readEnquiries(null), { rows: [], total: 0, page: 0 });
});

test('the site is the company site only when the ids match', () => {
  assert.equal(siteKind(enquiry(), 'site-company'), 'companySite');
  assert.equal(siteKind(enquiry({ siteId: 'site-general' }), 'site-company'), 'generalSite');
  assert.equal(siteKind(enquiry(), null), 'generalSite');
  assert.equal(siteKind(enquiry({ siteId: undefined }), undefined), 'generalSite');
});

test('the listing title comes from the publications, with generic labels otherwise', () => {
  const titles = listingTitles([
    { id: 'pub-1', snapshot: { title: ' Marina view apartment ' } },
    { id: 'pub-2', snapshot: {} },
    null,
  ]);
  assert.deepEqual([...titles], [['pub-1', 'Marina view apartment']]);
  assert.deepEqual(aboutLabel(enquiry(), titles), { title: 'Marina view apartment' });
  assert.deepEqual(aboutLabel(enquiry({ listingId: 'pub-2' }), titles), {
    key: 'propertyEnquiry',
  });
  assert.deepEqual(aboutLabel(enquiry({ listingId: null }), titles), { key: 'companyEnquiry' });
  assert.deepEqual(listingTitles(undefined).size, 0);
});

test('PostgreSQL timestamps become ISO instants shown in Dubai time', () => {
  const instant = enquiryInstant(enquiry().createdAt);
  assert.equal(instant, '2026-10-30T08:15:02.123Z');
  assert.equal(enquiryInstant('2026-10-30 08:15:02.5+00'), '2026-10-30T08:15:02.500Z');
  assert.equal(enquiryInstant('2026-10-30 08:15:02+04'), '2026-10-30T04:15:02.000Z');
  assert.equal(enquiryInstant('2026-10-30T08:15:02Z'), '2026-10-30T08:15:02.000Z');
  assert.equal(enquiryInstant('not a time'), '');
  assert.equal(enquiryInstant(null), '');
  const shown = createFormatters('en').dateTime(instant);
  assert.match(shown, /30 Oct 2026|Oct 30, 2026/);
  assert.match(shown, /12:15/);
});

test('assignees show a name, You, Not assigned or Former member', () => {
  const names = new Map([['member-1', 'Synthetic Agent']]);
  assert.deepEqual(assigneeLabel('member-1', names, 'admin-1'), { name: 'Synthetic Agent' });
  assert.deepEqual(assigneeLabel('admin-1', names, 'admin-1'), { key: 'you' });
  assert.deepEqual(assigneeLabel(null, names, 'admin-1'), { key: 'unassigned' });
  assert.deepEqual(assigneeLabel('gone-1', names, 'admin-1'), { key: 'formerMember' });
});

test('sender, contacts and preference read only what the visitor gave', () => {
  assert.equal(senderName(enquiry()), 'Synthetic Visitor');
  assert.equal(senderName({ enquiry: {} }), '—');
  assert.deepEqual(contactParts(enquiry()), ['visitor@example.test', '+971500000000']);
  assert.deepEqual(contactParts({ enquiry: { phone: '+971500000001', email: ' ' } }), [
    '+971500000001',
  ]);
  assert.equal(preference(enquiry()), 'whatsapp');
  assert.equal(preference({ enquiry: { contactPreference: 'carrier pigeon' } }), '');
});
