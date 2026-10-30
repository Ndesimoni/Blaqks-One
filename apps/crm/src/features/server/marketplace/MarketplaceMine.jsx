import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { JoinProfileFields } from './JoinProfileFields.jsx';
import { MarketplacePerson } from './MarketplaceAvatar.jsx';
import { MarketplaceFacts } from './MarketplaceFacts.jsx';
import { MarketplaceMineActions } from './MarketplaceMineActions.jsx';
import { MarketplaceMineDialogs } from './MarketplaceMineDialogs.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { MarketplaceRequestTabs } from './MarketplaceRequestTabs.jsx';
import { useMarketplaceTerms } from './useMarketplace.js';
import { useMyProfile } from './useMyProfile.js';

/**
 * The joined member's screen (packets MK1b and MK2): the newer-terms banner, the board and My
 * requests first (what the screen is for), then "My marketplace profile" with edit, photo,
 * preview and leave.
 */
export function MarketplaceMine({ member, onChanged }) {
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
        <section className="market-card market-banner">
          <p>{t('marketplaceJoin.mine.termsBanner', { version: member.termsVersion })}</p>
          <Button onClick={() => setDialog('terms')}>
            {t('marketplaceJoin.mine.reviewAccept')}
          </Button>
        </section>
      )}
      <MarketplaceRequestTabs />
      <section className="market-card">
        <h3>{t('marketplaceJoin.mine.title')}</h3>
        {mine.editing ? (
          <>
            <JoinProfileFields draft={mine.draft} onChange={mine.change} />
            {mine.problem && (
              <p className="field-error" role="alert">
                {t(`marketplaceJoin.join.problem.${mine.problem}`)}
              </p>
            )}
            <div className="market-actions">
              <Button onClick={mine.save} disabled={Boolean(mine.busy) || Boolean(mine.problem)}>
                {mine.busy === 'save'
                  ? t('marketplaceJoin.mine.saving')
                  : t('marketplaceJoin.mine.save')}
              </Button>
              <Button
                variant="light"
                onClick={() => mine.setEditing(false)}
                disabled={Boolean(mine.busy)}
              >
                {t('marketplaceJoin.mine.cancel')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <MarketplacePerson
              name={user.name}
              src={
                member.profile.hasPhoto ? api.marketplacePhotoUrl(user.workspaceId, user.id) : ''
              }
            />
            <MarketplaceFacts profile={member.profile} />
            <MarketplaceMineActions
              mine={mine}
              hasPhoto={member.profile.hasPhoto}
              onPreview={() => setDialog('preview')}
              onLeave={() => setDialog('leave')}
            />
          </>
        )}
        <input
          ref={mine.files}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t('marketplaceJoin.mine.photoAdd')}
          onChange={mine.upload}
        />
      </section>
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
