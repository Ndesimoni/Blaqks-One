import assert from 'node:assert/strict';
import test from 'node:test';
import { checkMessage } from '../src/lib/contact-message.ts';
import { help, searchHelp, topics } from '../src/lib/help.ts';

test('the help search matches questions and answers within a topic', () => {
  assert.equal(searchHelp(help, '').length, help.length);
  assert.ok(searchHelp(help, 'INVITE').some((item) => item.q === 'How do I add my team?'));
  assert.deepEqual(
    searchHelp(help, '', 'Marketplace').map((item) => item.topic),
    ['Marketplace'],
  );
  assert.equal(searchHelp(help, 'nothing like this').length, 0);
  assert.equal(topics[0], 'All');
});

test('the contact form names each problem and accepts a complete message', () => {
  const problems = checkMessage({
    name: ' ',
    email: 'not-an-email',
    mobile: 'call me',
    teamSize: 'huge',
  });
  assert.deepEqual(Object.keys(problems).sort(), [
    'company',
    'email',
    'message',
    'mobile',
    'name',
    'teamSize',
  ]);
  const ok = checkMessage({
    name: 'Aidah Simoni',
    company: 'Keys with Simoni',
    email: 'aidah@example.test',
    mobile: '+971 50 123 4567',
    teamSize: '4–15 people',
    message: 'We would like a demo for our team.',
  });
  assert.deepEqual(ok, {});
});
