import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import {
  counterparty,
  direction,
  displayState,
  filterByTab,
  inCompany,
  ownSide,
  partyOf,
  shareOf,
  stateTone,
  turn,
} from './agreementModel.js';

const PAGE_SIZE = 12;

/** Skeleton rows while the first list loads: no spinner, no layout jump. */
function ListSkeleton({ label }) {
  return (
    <div className="agreements-skeleton" aria-busy="true" role="status" aria-label={label}>
      {[58, 44, 66].map((width) => (
        <span key={width} style={{ '--skeleton-width': `${width}%` }} />
      ))}
    </div>
  );
}

function AgreementRow({ agreement, onOpen }) {
  const { user } = useSession();
  const { t, format } = useI18n();
  const summary = agreement.summary || {};
  const state = displayState(agreement, summary.authorParty);
  const other = counterparty(agreement, user.workspaceId, user.id);
  const name = other.name || t('agreements.party.unknown');
  const where = direction(agreement, user.workspaceId, user.id) === 'sent' ? 'to' : 'from';
  const move = turn(agreement, partyOf(agreement, user), summary.authorParty);
  const details = [other.company, summary.listingRef, summary.area].filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" className="agreement-row" onClick={() => onOpen(agreement.id)}>
        <span className="agreement-row-main">
          <span className="agreement-row-kind">
            {inCompany(agreement)
              ? t('agreements.kind.inCompany', { kind: t(`agreements.kind.${agreement.kind}`) })
              : t(`agreements.kind.${agreement.kind}`)}
          </span>
          <strong>{t(`agreements.row.${where}`, { name })}</strong>
          {details && <span className="agreement-row-sub">{details}</span>}
        </span>
        <span className="agreement-row-share">
          <small>{t('agreements.row.yourShare')}</small>
          <strong>
            {format.percent(shareOf(summary, ownSide(agreement, user.workspaceId, user.id)))}
          </strong>
        </span>
        <span className="agreement-row-status">
          <Badge tone={stateTone(state)}>{t(`agreements.state.${state}`)}</Badge>
          <small className={move === 'yourAnswer' ? 'is-urgent' : ''}>
            {move === 'closed'
              ? t('agreements.row.updated', { date: format.date(agreement.updatedAt) })
              : t(`agreements.turn.${move}`)}
          </small>
        </span>
        <Icon name="chevron" size={16} />
      </button>
    </li>
  );
}

/** The selected tab's agreements, newest first, twelve per page. */
export function AgreementList({ list, tab, onOpen, onCreate }) {
  const { user } = useSession();
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  if (list.status === 'loading') return <ListSkeleton label={t('agreements.loading')} />;
  if (list.status === 'error')
    return (
      <section className="panel agreements-state" role="alert">
        <Icon name="info" size={26} />
        <strong>{t('agreements.loadFailed')}</strong>
        <Button variant="light" onClick={list.reload}>
          {t('agreements.retry')}
        </Button>
      </section>
    );
  if (!list.items.length)
    return (
      <section className="panel agreements-empty">
        <Empty
          icon="note"
          title={t('agreements.empty.title')}
          detail={t('agreements.empty.body')}
          action={
            <Button icon="plus" onClick={onCreate}>
              {t('agreements.new')}
            </Button>
          }
        />
      </section>
    );
  const shown = filterByTab(list.items, tab, user.workspaceId, user.id);
  if (!shown.length)
    return (
      <section className="panel agreements-state">
        <Icon name="note" size={26} />
        <strong>{t(`agreements.empty.${tab}`)}</strong>
      </section>
    );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <section className="agreements-list-panel" aria-label={t(`agreements.tabs.${tab}`)}>
      <ul className="agreements-list">
        {shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((agreement) => (
          <AgreementRow key={agreement.id} agreement={agreement} onOpen={onOpen} />
        ))}
      </ul>
      <Pagination
        total={shown.length}
        page={current}
        pageSize={PAGE_SIZE}
        label={t('agreements.pages')}
        itemLabel={t('agreements.items')}
        onChange={setPage}
      />
    </section>
  );
}
