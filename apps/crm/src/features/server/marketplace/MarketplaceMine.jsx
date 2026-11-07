import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceMineDialogs } from './MarketplaceMineDialogs.jsx';
import { MarketplaceProfileCard } from './MarketplaceProfileCard.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { MarketplaceBoard } from './MarketplaceBoard.jsx';
import { MarketplaceNotifications } from './MarketplaceNotifications.jsx';
import { MarketplaceRequests } from './MarketplaceRequests.jsx';
import { useMarketplaceTerms } from './useMarketplace.js';
import { useMyProfile } from './useMyProfile.js';

/**
 * The joined member's screen (packets MK1b and MK2) for one Marketplace section (design queue
 * items 26–30): the newer-terms notice, then the board, My requests, Updates or "My marketplace
 * profile" with edit, photo, preview and leave.
 */
export function MarketplaceMine({ member, view, onChanged }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const terms = useMarketplaceTerms(member.termsVersion);
  const mine = useMyProfile(member.profile, onChanged);
  const [dialog, setDialog] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = async (name, action) => {
    setBusy(name);
    setError('');
    try {
      await action();
      setDialog('');
      onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="market-mine">
      {!member.termsCurrent && (
        <section className="market-banner">
          <Icon name="info" size={20} />
          <p>{t('marketplaceJoin.mine.termsBanner', { version: member.termsVersion })}</p>
          <Button onClick={() => setDialog('terms')}>
            {t('marketplaceJoin.mine.reviewAccept')}
          </Button>
        </section>
      )}
      {view === 'board' && <MarketplaceBoard />}
      {view === 'mine' && <MarketplaceRequests />}
      {view === 'updates' && <MarketplaceNotifications />}
      {view === 'profile' && (
        <MarketplaceProfileCard
          member={member}
          mine={mine}
          onPreview={() => setDialog('preview')}
          onLeave={() => setDialog('leave')}
        />
      )}
      {dialog === 'preview' && (
        <MarketplaceProfileDialog memberId={user.id} onClose={() => setDialog('')} />
      )}
      <MarketplaceMineDialogs
        dialog={dialog}
        terms={terms.value}
        busy={busy}
        error={error}
        onClose={() => setDialog('')}
        onAccept={(answer) =>
          run('terms', () =>
            api.acceptMarketplaceTerms(user.workspaceId, {
              termsVersion: terms.value.version,
              termsDigest: terms.value.digest,
              ...answer,
            }),
          )
        }
        onLeave={() => run('leave', () => api.leaveMarketplace(user.workspaceId))}
      />
    </div>
  );
}
