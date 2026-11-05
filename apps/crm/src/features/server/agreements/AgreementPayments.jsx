import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { Facts } from './AgreementTerms.jsx';
import { PaymentForm } from './PaymentForm.jsx';
import { paymentStatus } from './paymentModel.js';

export function AgreementPayments({ view }) {
  const { api, user } = useSession();
  const { t, format } = useI18n();
  const { agreement, party } = view.detail;
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api
      .agreementPayments(user.workspaceId, agreement.id, controller.signal)
      .then(setData)
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [api, user.workspaceId, agreement.id, agreement.version, retry]);
  if (agreement.origin === 'deal_handover' || agreement.kind === 'handover_full') return null;
  if (failed)
    return (
      <section role="alert">
        <p>{t('agreementLifecycle.paymentFailed')}</p>
        <Button variant="light" onClick={() => setRetry((value) => value + 1)}>
          {t('agreements.retry')}
        </Button>
      </section>
    );
  if (!data) return <p role="status">{t('agreements.detail.loading')}</p>;
  const { summary, payments } = data;
  if (!summary.available)
    return (
      <Facts
        title={t('agreementLifecycle.payments')}
        rows={[[t('agreementLifecycle.payments'), t('agreementLifecycle.unavailable')]]}
      />
    );
  const payee = summary.payer === 'sender' ? 'recipient' : 'sender';
  const editable = ['accepted', 'completed'].includes(agreement.state);
  const act = async (name, entry) => {
    const text = t(
      `agreementLifecycle.${name === 'confirmPayment' ? 'confirmEntry' : 'withdrawEntry'}`,
      {
        amount: format.money(entry.amountFils),
        date: format.date(entry.paidOn),
      },
    );
    if (confirm(text)) await view.run(name, entry.id);
  };
  return (
    <section className="agreement-payments">
      <Facts
        title={t('agreementLifecycle.payments')}
        rows={[
          [t('agreementLifecycle.payer'), agreement.parties?.[summary.payer]?.name],
          [t('agreementLifecycle.payee'), agreement.parties?.[payee]?.name],
          ...['due', 'paid', 'confirmed', 'outstanding'].map((key) => [
            t(`agreementLifecycle.${key}`),
            format.money(summary[`${key}Fils`]),
          ]),
        ]}
      />
      <p className="agreement-muted">{t('agreementLifecycle.paymentNotice')}</p>
      {editable && party === summary.payer && (
        <PaymentForm view={view} remaining={summary.dueFils - summary.paidFils} />
      )}
      {!payments.length && <p>{t('agreementLifecycle.noPayments')}</p>}
      <ol className="agreement-payment-list">
        {payments
          .filter((entry) => entry.action === 'paid')
          .map((entry) => {
            const status = paymentStatus(entry, payments);
            return (
              <li key={entry.id}>
                <strong>{format.money(entry.amountFils)}</strong>
                <span>
                  {format.date(entry.paidOn)} ·{' '}
                  {t(
                    `agreementLifecycle.payment${{ paid: 'Paid', confirmed: 'Confirmed', withdrawn: 'Withdrawn' }[status]}`,
                  )}
                </span>
                {editable && status === 'paid' && party && (
                  <Button
                    variant="light"
                    disabled={view.busy}
                    onClick={() =>
                      act(party === summary.payer ? 'withdrawPayment' : 'confirmPayment', entry)
                    }
                  >
                    {t(
                      `agreementLifecycle.${party === summary.payer ? 'withdrawPayment' : 'confirmPayment'}`,
                    )}
                  </Button>
                )}
              </li>
            );
          })}
      </ol>
    </section>
  );
}
