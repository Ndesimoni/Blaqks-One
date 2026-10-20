import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';

/** Skeleton rows while the list loads: no spinner, and still under reduced motion. */
export function ListSkeleton() {
  const { t } = useI18n();
  return (
    <div className="inbox-skeleton" aria-busy="true" aria-label={t('inbox.list.loading')}>
      {[55, 40, 62, 48].map((width) => (
        <div key={width} className="inbox-skeleton-row">
          <span className="inbox-skeleton-avatar" />
          <span className="inbox-skeleton-lines">
            <span style={{ inlineSize: `${width}%` }} />
            <span style={{ inlineSize: `${width + 25}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ListError({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="inbox-state" role="alert">
      <Icon name="info" size={28} />
      <strong>{t('inbox.state.loadFailed')}</strong>
      <Button variant="light" onClick={onRetry}>
        {t('inbox.state.retry')}
      </Button>
    </div>
  );
}

/** No channel yet (with the Admin's next step), no search results, or all caught up. */
export function ListEmpty({ searching, channels, ready }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { navigate } = useNavigation();
  if (searching)
    return (
      <div className="inbox-state">
        <Icon name="search" size={28} />
        <strong>{t('inbox.state.noMatches')}</strong>
      </div>
    );
  if (ready && channels.length === 0)
    return (
      <div className="inbox-state">
        <Icon name="chat" size={32} />
        <strong>{t('inbox.state.noChannelsTitle')}</strong>
        <span>{t('inbox.state.noChannelsBody')}</span>
        {user?.roleId === 'admin' ? (
          <Button onClick={() => navigate('Channels')}>{t('inbox.state.goToChannels')}</Button>
        ) : (
          <small>{t('inbox.state.askAdmin')}</small>
        )}
      </div>
    );
  return (
    <div className="inbox-state is-calm">
      <Icon name="check" size={32} />
      <strong>{t('inbox.state.caughtUpTitle')}</strong>
      <span>{t('inbox.state.caughtUpBody')}</span>
    </div>
  );
}

/** Desktop placeholder before a conversation is chosen. */
export function NoSelection() {
  const { t } = useI18n();
  return (
    <div className="inbox-state is-calm">
      <Icon name="chat" size={32} />
      <strong>{t('inbox.state.pickTitle')}</strong>
      <span>{t('inbox.state.pickBody')}</span>
    </div>
  );
}
