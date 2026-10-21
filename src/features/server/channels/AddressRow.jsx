import React, { useId, useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { displayNameProblem } from './addressModel.js';
import { ChannelField } from './ChannelField.jsx';
import { ConfirmDisconnect } from './ConfirmDisconnect.jsx';

/** One sending address with Rename and Keep for former member (never deleted or reassigned). */
export function AddressRow({ address, memberName, t, busy, onRename, onReserve }) {
  const id = useId();
  const [step, setStep] = useState(null);
  const [name, setName] = useState(address.displayName);
  const [error, setError] = useState('');
  const active = address.state === 'active';
  const owner = memberName || t('emailAddresses.formerMember');
  const rename = async (event) => {
    event.preventDefault();
    const problem = displayNameProblem(name);
    setError(problem ? t(problem) : '');
    if (problem) return;
    const failure = await onRename(address, name.trim());
    if (failure) setError(failure);
    else setStep(null);
  };
  return (
    <div className="address-row">
      <div className="address-main">
        <strong className="u-ltr">
          <bdi>{address.address}</bdi>
        </strong>
        <Badge tone={active ? 'green' : 'slate'}>
          {t(active ? 'emailAddresses.active' : 'emailAddresses.reserved')}
        </Badge>
      </div>
      <small>{t('emailAddresses.shownAs', { name: address.displayName, member: owner })}</small>
      {!active && <small>{t('emailAddresses.reservedHint', { member: owner })}</small>}
      {step === 'rename' ? (
        <form className="address-rename" onSubmit={rename} noValidate>
          <ChannelField id={`${id}-name`} label={t('emailAddresses.displayName')}>
            <input
              id={`${id}-name`}
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </ChannelField>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="channel-actions">
            <Button type="submit" disabled={busy}>
              {t('emailAddresses.saveName')}
            </Button>
            <Button variant="light" disabled={busy} onClick={() => setStep(null)}>
              {t('channels.cancel')}
            </Button>
          </div>
        </form>
      ) : step === 'reserve' ? (
        <ConfirmDisconnect
          t={t}
          busy={busy}
          title={t('emailAddresses.reserveTitle', { address: address.address })}
          body={t('emailAddresses.reserveBody', { member: owner })}
          action={t('emailAddresses.reserve')}
          onCancel={() => setStep(null)}
          onConfirm={async () => {
            if (!(await onReserve(address))) setStep(null);
          }}
        />
      ) : (
        active && (
          <div className="channel-actions">
            <Button
              variant="light"
              disabled={busy}
              aria-label={t('emailAddresses.renameFor', { address: address.address })}
              onClick={() => {
                setName(address.displayName);
                setError('');
                setStep('rename');
              }}
            >
              {t('emailAddresses.rename')}
            </Button>
            <Button
              variant="light"
              disabled={busy}
              aria-label={t('emailAddresses.reserveFor', { address: address.address })}
              onClick={() => setStep('reserve')}
            >
              {t('emailAddresses.reserve')}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
