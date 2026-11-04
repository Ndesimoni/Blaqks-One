import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useSession } from '../../hooks/useSession.js';
import { formatPercent } from '../../lib/finance/money.js';
import { useFinance } from '../server/finance/useFinance.js';
import { useFinanceActions } from '../server/finance/useFinanceActions.js';
import { readAgreementDeleted } from '../server/finance/settingsModel.js';
import { agreementAgents, dubaiToday } from './agreementModel.js';
import { useAgreements } from './useAgreements.js';
import { FinanceSettingsPanel } from './FinanceSettingsPanel.jsx';
import { AgreementList } from './AgreementList.jsx';
import { AgreementEditor } from './AgreementEditor.jsx';
import { useI18n } from '../../i18n/useI18n.js';

const createdNotice = ({ agreement, closed }) =>
  `Agreement added for ${agreement.agent.name}: ${formatPercent(agreement.agentShareBp)} from ${agreement.effectiveFrom}.` +
  (closed ? ` Their previous agreement now closes on ${closed.effectiveTo}.` : '');

const removedNotice = (reopened) => {
  if (!reopened) return 'Agreement removed.';
  return reopened.effectiveTo
    ? `Agreement removed. The agreement it replaced now runs until ${reopened.effectiveTo}.`
    : 'Agreement removed. The agreement it replaced has no end date again.';
};

/**
 * Team & access → Finance settings (finance-design §7): the Admin's settings panel and agent
 * agreements. Team finance staff may read the agreements; only the Admin edits.
 */
export function TeamFinanceSection({ owner, members }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const finance = useFinance(api, owner.id, user);
  const settingsActions = useFinanceActions({ api, workspaceId: owner.id, user, finance });
  const agreementActions = useFinanceActions({ api, workspaceId: owner.id, user, finance });
  const { access } = finance;
  const list = useAgreements(api, owner.id, access.teamView);
  const agents = useMemo(() => agreementAgents(members), [members]);
  const [notice, setNotice] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(null);
  const removeOpener = useRef(null);
  const created = (result) => {
    setRemoveError('');
    setNotice(createdNotice(result));
    list.reload();
  };
  const askRemove = (agreement, opener) => {
    if (!agreementActions.busy) {
      setRemoveError('');
      removeOpener.current = opener;
      setRemoving({ agreement });
    }
  };
  const cancelRemove = () => {
    const opener = removeOpener.current;
    setRemoving(null);
    setRemoveError('');
    removeOpener.current = null;
    requestAnimationFrame(() => opener?.focus());
  };
  const remove = async () => {
    if (!removing || agreementActions.busy) return;
    setNotice('');
    const result = await agreementActions.deleteAgreement(removing.agreement.id);
    if (!result.ok) return setRemoveError(result.message);
    setRemoving(null);
    removeOpener.current = null;
    setRemoveError('');
    list.reload();
    try {
      setNotice(removedNotice(readAgreementDeleted(result.result).reopened));
    } catch {
      setNotice('Agreement removed.');
    }
  };
  if (!finance.overview && finance.loading) return <p role="status">Loading finance settings…</p>;
  if (!finance.overview)
    return (
      <section className="panel team-finance-panel team-finance-recovery">
        <p className="field-error" role="alert">
          {finance.error}
        </p>
        <Button variant="light" onClick={finance.retry}>
          Retry
        </Button>
      </section>
    );
  return (
    <>
      <p className="panel team-finance-approval-note" role="note">
        {t('teamFinance.approvalNote')}
      </p>
      {access.manage && (
        <FinanceSettingsPanel settings={finance.overview.settings} actions={settingsActions} />
      )}
      <p className="team-finance-status" role="status">
        {notice}
      </p>
      <AgreementList
        list={list}
        today={dubaiToday()}
        readOnly={!access.manage}
        busy={agreementActions.busy}
        removing={removing}
        removeError={removeError}
        onAskRemove={askRemove}
        onCancelRemove={cancelRemove}
        onConfirmRemove={remove}
      />
      {access.manage && (
        <AgreementEditor
          agents={agents}
          agreements={list.agreements}
          actions={agreementActions}
          onCreated={created}
        />
      )}
    </>
  );
}
