import React, { useId, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useSession } from '../../hooks/useSession.js';

export function SeatLimitDialog({ workspaceId, seats, onClose, onSaved }) {
  const { api } = useSession();
  const { t } = useI18n();
  const titleId = useId();
  const errorId = useId();
  const [value, setValue] = useState(String(seats.limit));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => !busy && onClose();
  const submit = async (event) => {
    event.preventDefault();
    const memberLimit = Number(value);
    if (!Number.isInteger(memberLimit) || memberLimit < seats.used || memberLimit > 10_000) {
      setError(t('teamSeats.limitInvalid', { used: seats.used }));
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(await api.updateSeatLimit(workspaceId, { memberLimit, version: seats.version }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer titleId={titleId} onClose={close}>
      <form onSubmit={submit}>
        <div className="drawer-top">
          <div>
            <h2 id={titleId} tabIndex="-1" data-initial-focus>
              {t('teamSeats.changeTitle')}
            </h2>
            <p>{t('teamSeats.changeBody', { used: seats.used })}</p>
          </div>
          <Button variant="light" disabled={busy} onClick={close}>
            {t('teamSeats.close')}
          </Button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label htmlFor="company-seat-limit">{t('teamSeats.limitLabel')}</label>
            <input
              id="company-seat-limit"
              type="number"
              min={seats.used}
              max="10000"
              value={value}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          {error && (
            <p id={errorId} className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={close}>
            {t('teamSeats.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t(busy ? 'teamSeats.saving' : 'teamSeats.save')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
