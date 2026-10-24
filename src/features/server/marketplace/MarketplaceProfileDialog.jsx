import React, { useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { MarketplacePerson } from './MarketplaceAvatar.jsx';
import { MarketplaceFacts } from './MarketplaceFacts.jsx';
import { readProfile } from './marketplaceProfileModel.js';

/**
 * "Preview how others see me" (packet MK1b): the profile through the same read another company
 * uses, so a member sees exactly what is published — never an email or a phone.
 */
export function MarketplaceProfileDialog({ memberId, onClose }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [state, setState] = useState({ loading: true, value: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    api
      .marketplaceProfile(user.workspaceId, memberId, controller.signal)
      .then((value) => setState({ loading: false, value: readProfile(value), error: '' }))
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState({ loading: false, value: null, error: failure.message });
      });
    return () => controller.abort();
  }, [api, user.workspaceId, memberId]);
  const profile = state.value;
  return (
    <FinanceDialog title={t('marketplaceJoin.profile.title')} onClose={onClose}>
      {state.loading && <p role="status">{t('marketplace.loading')}</p>}
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      {profile && (
        <div className="market-profile">
          <MarketplacePerson
            name={profile.name}
            company={profile.company}
            src={profile.hasPhoto ? api.marketplacePhotoUrl(user.workspaceId, memberId) : ''}
          />
          <MarketplaceFacts profile={profile} />
        </div>
      )}
    </FinanceDialog>
  );
}
