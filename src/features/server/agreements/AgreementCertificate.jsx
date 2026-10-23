import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { downloadJson } from '../../../services/files/download.js';
import { CertificateEvidence } from './CertificateEvidence.jsx';

/** Scoped JSON is rendered as text only; the server is the source of all evidence. */
export function AgreementCertificate({ id, onClose }) {
  const { api, user } = useSession();
  const { t, format } = useI18n();
  const titleId = useId();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api
      .agreementCertificate(user.workspaceId, id, controller.signal)
      .then(setData)
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [api, user.workspaceId, id, retry]);
  return (
    <Drawer className="agreement-certificate" size="wide" titleId={titleId} onClose={onClose}>
      <div className="drawer-top">
        <h2 id={titleId} tabIndex={-1} data-initial-focus>
          {t('agreementLifecycle.certificate')}
        </h2>
        <Button variant="light" onClick={onClose}>
          {t('agreements.action.close')}
        </Button>
      </div>
      <div className="drawer-body agreement-body">
        {failed ? (
          <div role="alert">
            <p>{t('agreementLifecycle.certificateFailed')}</p>
            <Button variant="light" onClick={() => setRetry((value) => value + 1)}>
              {t('agreements.retry')}
            </Button>
          </div>
        ) : !data ? (
          <p role="status">{t('agreements.detail.loading')}</p>
        ) : (
          <>
            <p>
              {t('agreementLifecycle.generated', {
                date: format.dateTime(data.display.generatedAt),
              })}
            </p>
            <CertificateEvidence certificate={data} />
          </>
        )}
      </div>
      <div className="drawer-footer">
        <Button
          variant="light"
          disabled={!data || failed}
          onClick={() => downloadJson(data, `agreement-${id}-evidence.json`)}
        >
          {t('agreementLifecycle.download')}
        </Button>
        <Button disabled={!data || failed} onClick={() => window.print()}>
          {t('agreementLifecycle.print')}
        </Button>
      </div>
    </Drawer>
  );
}
