import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { Composer } from './Composer.jsx';
import { ConversationHeader } from './ConversationHeader.jsx';
import { channelHealth } from './inboxModel.js';
import { NoSelection } from './InboxStates.jsx';
import { Thread } from './Thread.jsx';

/** The channel's connection problem, if any, with the Admin's way to fix it. */
function ChannelBanner({ health, channel, user }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  if (health === 'connected') return null;
  const name = t(`inbox.channel.${channel}`);
  return (
    <div className="inbox-banner" role="status">
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
  onDetails,
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
  const update = async (changes) => {
    setBusy(true);
    const failure = await conversation.update(changes);
    setBusy(false);
    setProblem(failure ? t('inbox.header.changeFailed') : '');
  };
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
        onDetails={onDetails}
      />
      {problem && (
        <p className="field-error inbox-problem" role="alert">
          {problem}
        </p>
      )}
      <ChannelBanner
        health={channelHealth(channels, row.channel)}
        channel={row.channel}
        user={user}
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
