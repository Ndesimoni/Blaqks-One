import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { AddressForm } from './AddressForm.jsx';
import { eligibleMembers, withAdmin } from './addressModel.js';
import { AddressRow } from './AddressRow.jsx';
import { useAddressActions } from './useAddressActions.js';
import { useAddresses } from './useAddresses.js';
import './addresses.css';

/**
 * Sending addresses on the company's SendGrid domain (E3d), Admin only. One small complete
 * section with actions on every row, so every address is listed (docs/option-overflow.md).
 */
export function SendingAddresses({ api, workspaceId, connection, admin, t }) {
  const loaded = useAddresses(api, workspaceId, connection.version);
  const { data, error, reload } = loaded;
  const members = withAdmin(loaded.members, admin);
  const [adding, setAdding] = useState(false);
  const names = new Map(members.map((member) => [member.id, member.name]));
  const addresses = data?.addresses ?? [];
  const eligible = eligibleMembers(members, addresses);
  const actions = useAddressActions({ api, workspaceId, domain: data?.domain, reload, t });
  const { busy, notice } = actions;
  const add = async (body) => {
    const failure = await actions.add(body);
    if (!failure) setAdding(false);
    return failure;
  };
  return (
    <section className="channel-card addresses-card" aria-labelledby="sending-addresses">
      <header className="channel-head">
        <span className="channel-icon" aria-hidden="true">
          <Icon name="person" size={20} />
        </span>
        <div>
          <h2 id="sending-addresses">{t('emailAddresses.title')}</h2>
          <p>
            {data?.domain
              ? t('emailAddresses.intro', { domain: data.domain })
              : t('emailAddresses.introPending')}
          </p>
        </div>
        {data?.domain && !adding && (
          <Button icon="plus" disabled={busy} onClick={() => setAdding(true)}>
            {t('emailAddresses.add')}
          </Button>
        )}
      </header>
      <div aria-live="polite">{notice && <p className="channels-notice">{notice}</p>}</div>
      {error ? (
        <div className="channel-actions" role="alert">
          <p className="field-error">{t('emailAddresses.loadError')}</p>
          <Button variant="light" onClick={reload}>
            {t('channels.retry')}
          </Button>
        </div>
      ) : !data ? (
        <p className="channels-muted" role="status">
          {t('emailAddresses.loading')}
        </p>
      ) : (
        <>
          {adding &&
            (eligible.length ? (
              <AddressForm
                domain={data.domain}
                members={eligible}
                t={t}
                busy={busy}
                onSubmit={add}
                onClose={() => setAdding(false)}
              />
            ) : (
              <div className="channel-form">
                <p className="channels-muted">{t('emailAddresses.noneEligible')}</p>
                <div className="channel-actions">
                  <Button variant="light" onClick={() => setAdding(false)}>
                    {t('channels.cancel')}
                  </Button>
                </div>
              </div>
            ))}
          {addresses.length === 0 ? (
            !adding && <p className="channels-muted">{t('emailAddresses.empty')}</p>
          ) : (
            <OverflowList
              mode="all"
              items={addresses}
              getKey={(address) => address.id}
              label={t('emailAddresses.title')}
              listClassName="address-list"
              renderItem={(address) => (
                <AddressRow
                  key={`${address.id}-${address.version}`}
                  address={address}
                  memberName={names.get(address.memberId)}
                  t={t}
                  busy={busy}
                  onRename={actions.rename}
                  onReserve={actions.reserve}
                  onRemove={actions.remove}
                />
              )}
            />
          )}
        </>
      )}
    </section>
  );
}
