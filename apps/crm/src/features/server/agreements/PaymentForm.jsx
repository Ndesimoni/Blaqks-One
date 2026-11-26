import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { FinanceField } from '../finance/FinanceField.jsx';
import { readPayment } from './paymentModel.js';

export function PaymentForm({ view, remaining }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(dubaiToday());
  const [invalid, setInvalid] = useState(false);
  useUnsavedChanges(Boolean(amount), view.busy, t('agreementForm.discard'));
  return (
    <form
      className="form-grid agreement-payment-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const payment = readPayment(amount, paidOn, remaining);
        setInvalid(!payment);
        if (payment && (await view.run('recordPayment', payment))) setAmount('');
      }}
    >
      <FinanceField name="paymentAmount" label={t('agreementLifecycle.amount')} required>
        {(props) => (
          <input
            {...props}
            value={amount}
            inputMode="decimal"
            disabled={view.busy}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setAmount(event.target.value);
              setInvalid(false);
            }}
          />
        )}
      </FinanceField>
      <FinanceField name="paidOn" label={t('agreementLifecycle.paidOn')} required>
        {(props) => (
          <input
            {...props}
            type="date"
            value={paidOn}
            max={dubaiToday()}
            disabled={view.busy}
            onChange={(event) => {
              setPaidOn(event.target.value);
              setInvalid(false);
            }}
          />
        )}
      </FinanceField>
      {invalid && (
        <p className="span-all" role="alert">
          {t('agreementLifecycle.invalidPayment')}
        </p>
      )}
      <div className="span-all">
        <Button type="submit" disabled={view.busy || remaining <= 0}>
          {t(view.busy ? 'agreements.action.working' : 'agreementLifecycle.recordPayment')}
        </Button>
      </div>
    </form>
  );
}
