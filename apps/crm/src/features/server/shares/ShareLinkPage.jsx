import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { shareLinkId } from './shareModel.js';
import { useShareActions } from './useShareActions.js';
import { useShareView } from './useShareReads.js';
import { ShareFacts } from './ShareFacts.jsx';

/**
 * The share link `#/shares/{id}` (record sharing R1, amendment 7): the colleague reviews the
 * offer and accepts or declines it; its sender, the record's holder and the Admin see its
 * status. Everyone else, and any refused read, sees one plain "isn't available" message.
 */
export function ShareLinkPage() {
  const { pathname } = useLocation();
  const { user } = useSession();
  const { navigate } = useNavigation();
  const { refresh } = useRecords();
  const { t } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const view = useShareView(shareLinkId(pathname));
  const { busy, decide } = useShareActions(refresh);
  const [answered, setAnswered] = useState(null);
  const [message, setMessage] = useState('');
  const share = answered || view.value;
  const section = share && canOpenSection(user, share.collection) ? share.collection : null;
  const leave = () => navigate(section || 'Dashboard');
  const answer = async (action) => {
    setMessage('');
    const result = await decide(share, action);
    if (result.ok) setAnswered(result.share);
    else setMessage(result.message);
  };
  const opened = share?.status === 'accepted' && share.to.id === user.id && section;
  const base = { eyebrow: k('linkEyebrow'), onClose: leave, busy: Boolean(busy), message };
  if (!share)
    return (
      <FinanceDialog {...base} title={k('title')}>
        {view.loading ? (
          <p role="status">{k('loadingShare')}</p>
        ) : (
          <p role="alert">{[403, 404].includes(view.status) ? k('unavailable') : view.error}</p>
        )}
      </FinanceDialog>
    );
  const decision = share.allowed.accept
    ? {
        onSubmit: () => answer('accept'),
        submitLabel: k('accept'),
        secondary: share.allowed.decline && {
          label: k('decline'),
          onClick: () => answer('decline'),
        },
      }
    : opened
      ? { onSubmit: leave, submitLabel: k('open', { section: k(`section.${share.collection}`) }) }
      : {};
  return (
    <FinanceDialog {...base} {...decision} title={share.label || k('noLabel')}>
      <ShareFacts share={share} me={user.id} />
      {opened && (
        <p className="record-share-done" role="status">
          {k('linkAccepted', { section: k(`section.${share.collection}`) })}
        </p>
      )}
    </FinanceDialog>
  );
}
