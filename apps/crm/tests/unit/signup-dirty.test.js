import test from 'node:test';
import assert from 'node:assert/strict';
import { isDirty } from '../../src/features/signup/signupModel.js';

const details = { name: '', email: '', phone: '', password: '', consent: false };

test('the pre-filled company name is not unsaved input; a change or an emirate is', () => {
  const prefill = 'Synthetic Owner';
  const setup = (displayName, emirate = '') => ({ displayName, emirate });
  assert.equal(
    isDirty({ step: 3, finished: false, details, setup: setup(prefill), prefill }),
    false,
  );
  assert.equal(
    isDirty({ step: 3, finished: false, details, setup: setup('Realty'), prefill }),
    true,
  );
  assert.equal(
    isDirty({ step: 3, finished: false, details, setup: setup(prefill, 'dubai'), prefill }),
    true,
  );
  assert.equal(
    isDirty({ step: 3, finished: true, details, setup: setup('Realty'), prefill }),
    false,
  );
  assert.equal(
    isDirty({ step: 1, finished: false, details: { ...details, name: 'A' }, setup: setup('') }),
    true,
  );
});
