import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { KanbanBoard } from '../../../components/ui/kanban/KanbanBoard.jsx';
import '../../../components/ui/kanban/kanban.css';
import '../../../components/ui/kanban/kanban-card.css';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import {
  counterparty,
  displayState,
  filterByTab,
  ownSide,
  shareOf,
  stateTone,
} from './agreementModel.js';
import './agreement-board.css';

/** The mockup's columns, then ours for offers that ended without a deal. */
const COLUMNS = [
  ['draft', ['draft']],
  ['sent', ['sent', 'countered']],
  ['accepted', ['accepted']],
  ['completed', ['completed']],
  ['ended', ['declined', 'revoked', 'expired', 'cancelled']],
];

/**
 * The approved mockup's agreements board (design queue item 28): one column per state, each
 * card naming the agreement, the other company and your share. Agreements change state only
 * through their own actions and evidence, so cards open the agreement and never move.
 */
export function AgreementBoard({ list, tab, onOpen, onCreate }) {
  const { user } = useSession();
  const { t, format } = useI18n();
  const items = filterByTab(list.items, tab, user.workspaceId, user.id);
  const state = (agreement) => displayState(agreement, agreement.summary?.authorParty);
  const columns = COLUMNS.map(([key, states]) => ({
    key,
    title: t(`agreements.column.${key}`),
    tone: stateTone(states[0]),
    items: items.filter((agreement) => states.includes(state(agreement))),
  }));
  return (
    <KanbanBoard
      label={t('agreements.boardLabel')}
      columns={columns}
      itemKey={(agreement) => agreement.id}
      canMove={() => false}
      moveLabel={() => ''}
      onMove={() => {}}
      emptyTitle={t('agreements.empty.title')}
      emptyDetail={t(tab === 'all' ? 'agreements.empty.body' : `agreements.empty.${tab}`)}
      emptyAction={
        <Button icon="plus" onClick={onCreate}>
          {t('agreements.new')}
        </Button>
      }
      renderCard={(agreement) => {
        const other = counterparty(agreement, user.workspaceId, user.id);
        const share = shareOf(
          agreement.summary || {},
          ownSide(agreement, user.workspaceId, user.id),
        );
        return (
          <button type="button" className="agreement-card" onClick={() => onOpen(agreement.id)}>
            <strong>{t(`agreements.kind.${agreement.kind}`)}</strong>
            <span>
              {[
                other.company || other.name || t('agreements.party.unknown'),
                agreement.summary?.listingRef,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="agreement-card-meta">
              <span>{t(`agreements.state.${state(agreement)}`)}</span>
              <span>{t('agreements.card.share', { share: format.percent(share) })}</span>
            </span>
          </button>
        );
      }}
    />
  );
}
