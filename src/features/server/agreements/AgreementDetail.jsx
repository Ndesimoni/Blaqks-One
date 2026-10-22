import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementActions } from './AgreementActions.jsx';
import { AgreementEvidence, AgreementHistory, RevisionPicker } from './AgreementEvidence.jsx';
import { AgreementSummary } from './AgreementSummary.jsx';
import { AgreementTerms } from './AgreementTerms.jsx';
import { useAgreement } from './useAgreement.js';

function Notice({ notice }) {
  const { t } = useI18n();
  if (!notice) return null;
  const text = notice.key ? t(notice.key) : notice.message;
  return (
    <div
      className={'agreement-notice is-' + notice.tone}
      role={notice.tone === 'error' ? 'alert' : 'status'}
    >
      <Icon name={notice.tone === 'error' ? 'info' : 'check'} size={18} />
      <p>{text}</p>
    </div>
  );
}

function Body({ view, selected, onSelect }) {
  const { detail } = view;
  const { agreement, revision } = detail;
  const revisions = detail.revisions?.length ? detail.revisions : [revision];
  const shown = revisions.find((item) => item.number === selected) || revisions.at(-1);
  const acceptance = detail.events?.findLast((event) => event.action === 'accepted');
  const names = {
    sender: agreement.parties?.sender?.name,
    recipient: agreement.parties?.recipient?.name,
  };
  return (
    <div className="drawer-body agreement-body">
      <Notice notice={view.notice} />
      <AgreementSummary detail={detail} />
      <RevisionPicker
        revisions={revisions}
        selected={shown.number}
        current={revision.number}
        accepted={acceptance?.revision}
        onSelect={onSelect}
      />
      <AgreementTerms terms={shown.terms} names={names} />
      <AgreementEvidence
        agreement={agreement}
        revision={shown}
        total={revisions.at(-1).number}
        acceptance={acceptance}
      />
      <AgreementHistory agreement={agreement} events={detail.events} />
    </div>
  );
}

/**
 * One agreement in the shared centred dialog: status, both participants, the frozen terms
 * of any revision, its evidence digest, the history and exactly the caller's commands.
 */
export function AgreementDetail({ id, onClose, onChanged, onEdit }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const titleId = useId();
  const view = useAgreement(api, user.workspaceId, id);
  const [selected, setSelected] = useState(null);
  const close = () => {
    if (!view.busy) onClose();
  };
  const { detail } = view;
  const title = detail
    ? t(`agreements.kind.${detail.agreement.kind}`)
    : t('agreements.detail.title');
  const subtitle = detail?.revision.terms.subject.property?.listingRef;
  return (
    <Drawer className="agreement-dialog" size="wide" titleId={titleId} onClose={close}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">
            {t('agreements.detail.eyebrow')}
            {subtitle ? ` · ${subtitle}` : ''}
          </div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {title}
          </h2>
        </div>
        <button className="icon-btn" aria-label={t('agreements.detail.close')} onClick={close}>
          <Icon name="close" size={21} />
        </button>
      </div>
      {view.status === 'ready' ? (
        <>
          <Body view={view} selected={selected} onSelect={setSelected} />
          <AgreementActions
            view={view}
            onClose={close}
            onEdit={onEdit}
            onDone={() => {
              setSelected(null);
              onChanged();
            }}
          />
        </>
      ) : (
        <div className="drawer-body agreement-body">
          {view.status === 'loading' && (
            <p role="status" className="agreement-muted">
              {t('agreements.detail.loading')}
            </p>
          )}
          {view.status !== 'loading' && (
            <div className="agreements-state" role="alert">
              <Icon name="info" size={26} />
              <strong>
                {t(view.status === 'missing' ? 'agreements.error.gone' : 'agreements.loadFailed')}
              </strong>
              {view.status === 'error' && (
                <Button variant="light" onClick={view.reload}>
                  {t('agreements.retry')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
