import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { Composer } from './Composer.jsx';
import { ConversationHeader } from './ConversationHeader.jsx';
import { channelHealth } from './inboxModel.js';
import { NoSelection } from './InboxStates.jsx';
import { BlockedNotice, NewContactReview } from './NewContactReview.jsx';
import { Thread } from './Thread.jsx';

/** The channel's connection problem, if any, with the Admin's way to fix it. */
function ChannelBanner({ health, channel, user, compact }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  if (health === 'connected') return null;
  const name = t(`inbox.channel.${channel}`);
  return (
    <div className={'inbox-banner' + (compact ? ' is-compact' : '')} role="status">
      <Icon name="info" size={18} />
      <div>
        <strong>{t(`inbox.banner.${health}Title`, { channel: name })}</strong>
        <span>{t('inbox.banner.body')}</span>
      </div>
      {user.roleId === 'admin' && (
        <Button onClick={() => navigate('Channels')}>{t('inbox.banner.fix')}</Button>
      )}
    </div>
  );
}

/** Header, connection banner, thread and composer for the open conversation. */
export function ConversationView({
  conversation,
  user,
  channels,
  members,
  nameOf,
  onBack,
  onPanel,
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  if (conversation.status === 'idle') return <NoSelection />;
  if (conversation.status === 'loading')
    return (
      <div
        className="inbox-thread-loading"
        aria-busy="true"
        aria-label={t('inbox.thread.loading')}
      />
    );
  if (conversation.status === 'error')
    return (
      <div className="inbox-state" role="alert">
        <strong>{t('inbox.thread.missing')}</strong>
        <Button variant="light" onClick={onBack}>
          {t('inbox.header.back')}
        </Button>
      </div>
    );
  const { data } = conversation;
  const row = data.conversation;
  const perform = async (change) => {
    setBusy(true);
    const failure = await change();
    setBusy(false);
    setProblem(failure ? t('inbox.header.changeFailed') : '');
  };
  const update = (changes) => perform(() => conversation.update(changes));
  const act = (name) => perform(() => conversation[name]());
  const review = row.state !== 'spam' && row.match !== 'linked';
  return (
    <>
      <ConversationHeader
        row={row}
        user={user}
        members={members}
        nameOf={nameOf}
        busy={busy}
        onUpdate={update}
        onBack={onBack}
        onDetails={() => onPanel('details')}
      />
      {problem && (
        <p className="field-error inbox-problem" role="alert">
          {problem}
        </p>
      )}
      {review && (
        <NewContactReview row={row} user={user} busy={busy} onOpenPanel={onPanel} onAct={act} />
      )}
      {row.state === 'spam' && <BlockedNotice user={user} busy={busy} onAct={act} />}
      <ChannelBanner
        health={channelHealth(channels, row.channel)}
        channel={row.channel}
        user={user}
        compact={review}
      />
      <Thread data={data} nameOf={nameOf} />
      {row.state !== 'spam' && (
        <Composer
          conversation={row}
          user={user}
          channels={channels}
          onNote={conversation.addNote}
        />
      )}
    </>
  );
}
