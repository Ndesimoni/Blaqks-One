import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { JoinProfileFields } from './JoinProfileFields.jsx';
import { MarketplacePerson } from './MarketplaceAvatar.jsx';
import { MarketplaceFacts } from './MarketplaceFacts.jsx';
import { MarketplaceMineActions } from './MarketplaceMineActions.jsx';

/**
 * "My marketplace profile" (packet MK1b): the photo and name beside the everyday actions, the
 * published facts, and leaving on its own row below a hairline. Editing swaps the facts for
 * the join form's fields with Cancel and Save; a failed save keeps the form and its error.
 */
export function MarketplaceProfileCard({ member, mine, onPreview, onLeave }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const id = useId();
  const busy = Boolean(mine.busy);
  return (
    <section className="market-card market-profile-card" aria-labelledby={id}>
      <h2 id={id}>{t('marketplaceJoin.mine.title')}</h2>
      {mine.editing ? (
        <>
          <JoinProfileFields draft={mine.draft} onChange={mine.change} />
          {(mine.problem || mine.error) && (
            <p className="field-error" role="alert">
              {mine.problem ? t(`marketplaceJoin.join.problem.${mine.problem}`) : mine.error}
            </p>
          )}
          <div className="market-actions market-step-actions">
            <Button variant="light" onClick={() => mine.setEditing(false)} disabled={busy}>
              {t('marketplaceJoin.mine.cancel')}
            </Button>
            <Button onClick={mine.save} disabled={busy || Boolean(mine.problem)}>
              {mine.busy === 'save'
                ? t('marketplaceJoin.mine.saving')
                : t('marketplaceJoin.mine.save')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="market-profile-head">
            <MarketplacePerson
              name={user.name}
              src={
                member.profile.hasPhoto ? api.marketplacePhotoUrl(user.workspaceId, user.id) : ''
              }
            />
            <MarketplaceMineActions
              mine={mine}
              hasPhoto={member.profile.hasPhoto}
              onPreview={onPreview}
            />
          </div>
          <MarketplaceFacts profile={member.profile} />
          <div className="market-leave">
            <Button variant="danger-light" onClick={onLeave}>
              {t('marketplaceJoin.mine.leave')}
            </Button>
          </div>
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
  );
}
