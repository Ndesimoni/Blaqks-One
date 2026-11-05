import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { withAdmin } from './addressModel.js';
import { GiveNumberDialog } from './GiveNumberDialog.jsx';
import { NumberRow } from './NumberRow.jsx';
import { useNumberActions } from './useNumberActions.js';
import { useWhatsappNumbers } from './useWhatsappNumbers.js';
import { whatsappMembers } from './whatsappModel.js';

/**
 * Members' numbers (W1a, WQ3): the owning Admin gives each member with the WhatsApp grant one
 * number from the company's Twilio senders, and may disconnect any of them. One small
 * complete section with an action on every row, so every number is listed.
 */
export function WhatsappNumbers({ api, workspaceId, connection, admin, t }) {
  const { format } = useI18n();
  const loaded = useWhatsappNumbers(api, workspaceId, connection.version);
  const { error, reload } = loaded;
  const members = withAdmin(loaded.members, admin);
  const numbers = (loaded.numbers ?? []).filter((number) => number.state === 'active');
  const [giving, setGiving] = useState(false);
  const heading = useRef(null);
  const names = new Map(members.map((member) => [member.id, member.name]));
  const nameOf = (memberId) =>
    memberId === admin.id
      ? t('whatsappNumbers.you', { name: admin.name })
      : names.get(memberId) || t('whatsappNumbers.formerMember');
  const actions = useNumberActions({ api, workspaceId, nameOf, reload, t });
  const { busy, notice } = actions;
  useEffect(() => {
    if (notice?.done) heading.current?.focus();
  }, [notice]);
  const give = async (memberId, phone) => {
    const failure = await actions.give(memberId, phone);
    if (!failure) setGiving(false);
    return failure;
  };
  return (
    <section
      className="channel-card addresses-card whatsapp-numbers-card"
      aria-labelledby="whatsapp-numbers"
    >
      <header className="channel-head">
        <span className="channel-icon" aria-hidden="true">
          <Icon name="smartphone" size={20} />
        </span>
        <div>
          <h2 id="whatsapp-numbers" ref={heading} tabIndex={-1}>
            {t('whatsappNumbers.title')}
          </h2>
          <p>{t('whatsappNumbers.intro')}</p>
        </div>
        {loaded.numbers && (
          <Button icon="plus" disabled={busy} onClick={() => setGiving(true)}>
            {t('whatsappNumbers.give')}
          </Button>
        )}
      </header>
      <div role="status" aria-live="polite">
        {notice && (
          <p className={notice.error ? 'field-error' : 'channels-notice'}>{notice.text}</p>
        )}
      </div>
      {error ? (
        <div className="channel-actions" role="alert">
          <p className="field-error">{t('whatsappNumbers.loadError')}</p>
          <Button variant="light" onClick={reload}>
            {t('channels.retry')}
          </Button>
        </div>
      ) : !loaded.numbers ? (
        <p className="channels-muted" role="status">
          {t('whatsappNumbers.loading')}
        </p>
      ) : numbers.length === 0 ? (
        <div className="whatsapp-empty">
          <strong>{t('whatsappNumbers.empty')}</strong>
          <p>{t('whatsappNumbers.emptyHint')}</p>
        </div>
      ) : (
        <OverflowList
          mode="all"
          items={numbers}
          getKey={(number) => number.id}
          label={t('whatsappNumbers.title')}
          listClassName="address-list"
          renderItem={(number) => (
            <NumberRow
              key={`${number.id}-${number.version}`}
              number={number}
              memberName={nameOf(number.memberId)}
              t={t}
              format={format}
              busy={busy}
              onDisconnect={actions.disconnect}
            />
          )}
        />
      )}
      {giving && (
        <GiveNumberDialog
          api={api}
          workspaceId={workspaceId}
          members={whatsappMembers(members, numbers)}
          numbers={numbers}
          nameOf={nameOf}
          t={t}
          onClose={() => setGiving(false)}
          onGive={give}
        />
      )}
    </section>
  );
}
