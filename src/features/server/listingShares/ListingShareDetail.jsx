import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { downloadJson } from '../../../services/files/download.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from './listingShareLinks.js';
import { ListingShareConfirm } from './ListingShareConfirm.jsx';
import { ListingShareSteps } from './ListingShareSteps.jsx';
import { ListingShareSummary } from './ListingShareSummary.jsx';
import { ShareCoBroking } from './ShareCoBroking.jsx';
import { useListingShare } from './useListingShares.js';
import { useListingShareActions } from './useListingShareActions.js';

/**
 * One listing share (record sharing R2), also the link's target. The agent sees the twelve
 * basic facts and Accept or Decline while it waits, then the listing, its photos and the
 * sender's contact until the last day; the sender side sees everything with its steps; the
 * receiving Admin sees the introduction record only. Any refused read is "not available".
 * Either named person of an accepted share proposes co-broking over it, or opens the
 * co-broking agreement it led to.
 */
export function ListingShareDetail({ id, onClose, onChanged }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const view = useListingShare(id);
  const actions = useListingShareActions();
  const [latest, setLatest] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [coBroking, setCoBroking] = useState(null);
  const share = latest || view.value;
  const busy = Boolean(actions.busy);
  const done = (result, action) => {
    setConfirm('');
    if (!result.ok) {
      setMessage(result.message);
      view.reload();
      return;
    }
    setLatest(result.share);
    setNotice(k(`done.${action}`));
    onChanged?.();
  };
  if (!share)
    return (
      <FinanceDialog eyebrow={k('linkEyebrow')} title={k('title')} onClose={onClose}>
        {view.loading ? (
          <p role="status">{k('loadingShare')}</p>
        ) : (
          <p role="alert">{[403, 404].includes(view.status) ? k('unavailable') : view.error}</p>
        )}
      </FinanceDialog>
    );
  if (coBroking)
    return (
      <ShareCoBroking
        view={coBroking}
        onView={setCoBroking}
        onClose={() => {
          setCoBroking(null);
          setLatest(null);
          view.reload();
          onChanged?.();
        }}
      />
    );
  if (confirm)
    return (
      <ListingShareConfirm
        share={share}
        action={confirm}
        busy={busy}
        message={message}
        onBack={() => setConfirm('')}
        onSubmit={async (body) => done(await actions.decide(share, confirm, body), confirm)}
      />
    );
  const evidence = async () => {
    setMessage('');
    try {
      const data = await api.listingShareEvidence(user.workspaceId, share.id);
      downloadJson(data, `listing-share-${share.reference}-evidence.json`);
    } catch (failure) {
      setMessage(failure.message || k('failed'));
    }
  };
  // After answering, co-broking is the share's main step (proposing it, or opening it).
  const coBrokingStep = share.allowed.coBroking
    ? {
        onSubmit: () => setCoBroking({ form: { mode: 'share', detail: { share } } }),
        submitLabel: t('coBroking.propose'),
      }
    : share.coBroking && {
        onSubmit: () => setCoBroking({ id: share.coBroking.id }),
        submitLabel: t('coBroking.open'),
      };
  const answer = share.allowed.accept
    ? {
        onSubmit: () => setConfirm('accept'),
        submitLabel: k('accept'),
        secondary: share.allowed.decline && {
          label: k('decline'),
          onClick: () => setConfirm('decline'),
        },
      }
    : coBrokingStep || {};
  const file = (fileId) => api.listingShareFileUrl(user.workspaceId, share.id, fileId);
  return (
    <FinanceDialog
      eyebrow={k('detailEyebrow', { reference: share.reference })}
      title={share.label}
      busy={busy}
      message={message}
      onClose={onClose}
      dismissLabel={k('close')}
      wide
      className="outside-share-detail"
      {...answer}
    >
      <ListingShareSummary share={share} />
      {share.listing ? (
        <ListingView
          property={toProperty(share.listing, share.photos, share.floorPlans)}
          file={file}
        />
      ) : (
        <p className="record-share-empty">{k('noLongerAvailable')}</p>
      )}
      <ListingShareSteps
        share={share}
        busy={busy}
        onConfirm={setConfirm}
        onExtend={async (day) => done(await actions.extend(share, day), 'extend')}
        onEvidence={evidence}
      />
      <p className="record-share-done" role="status">
        {notice}
      </p>
    </FinanceDialog>
  );
}
