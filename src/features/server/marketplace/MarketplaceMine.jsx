import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { JoinProfileFields } from './JoinProfileFields.jsx';
import { MarketplacePerson } from './MarketplaceAvatar.jsx';
import { MarketplaceFacts } from './MarketplaceFacts.jsx';
import { MarketplaceMineActions } from './MarketplaceMineActions.jsx';
import { MarketplaceMineDialogs } from './MarketplaceMineDialogs.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { useMarketplaceTerms } from './useMarketplace.js';
import { useMyProfile } from './useMyProfile.js';

/**
 * The joined member's screen (packet MK1b): the newer-terms banner, "My marketplace profile"
 * with edit, photo, preview and leave, and the empty board until client requests arrive in MK2.
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
      <section className="market-card">
        <Empty
          icon="note"
          title={t('marketplaceJoin.mine.boardTitle')}
          detail={t('marketplaceJoin.mine.boardText')}
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
