import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementActions } from './AgreementActions.jsx';
import { AgreementBody } from './AgreementBody.jsx';
import { AgreementCertificate } from './AgreementCertificate.jsx';
import { useAgreement } from './useAgreement.js';

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
  const [certificate, setCertificate] = useState(false);
  const close = () => {
    if (!view.busy) onClose();
  };
  const { detail } = view;
  const title = detail
    ? t(`agreements.kind.${detail.agreement.kind}`)
    : t('agreements.detail.title');
  const subtitle = detail?.revision.terms.subject.property?.listingRef;
  if (certificate) return <AgreementCertificate id={id} onClose={() => setCertificate(false)} />;
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
          <AgreementBody view={view} selected={selected} onSelect={setSelected} />
          <div className="agreement-certificate-link">
            <Button variant="light" disabled={view.busy} onClick={() => setCertificate(true)}>
              {t('agreementLifecycle.certificate')}
            </Button>
          </div>
          <AgreementActions
            view={view}
            onClose={close}
            onEdit={onEdit}
            proposalReviewed={Boolean(detail.proposal && selected === detail.proposal.number)}
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
