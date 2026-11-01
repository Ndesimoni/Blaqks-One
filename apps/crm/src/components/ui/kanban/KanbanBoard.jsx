import React, { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { KanbanCard } from './KanbanCard.jsx';
import './kanban.css';

const LIMIT = 20;

/**
 * A Bitrix24-style pipeline (NAV, owner 2026-10-31): one column per stage with its count,
 * cards dragged between columns or moved with each card's ⋯ list. Columns show the first
 * twenty cards; Show all replaces them with the whole column, never a second copy.
 * `columns`: [{ key, title, tone, items }]; `onMove(item, columnKey)` persists the move.
 */
export function KanbanBoard({
  label,
  columns,
  itemKey,
  renderCard,
  canMove,
  moveLabel,
  onMove,
  busy = false,
  focusRequest,
  emptyTitle,
  emptyDetail,
  emptyAction,
}) {
  const { t } = useI18n();
  const id = useId();
  const root = useRef(null);
  const [menu, setMenu] = useState('');
  const [dragged, setDragged] = useState('');
  const [over, setOver] = useState('');
  const [expanded, setExpanded] = useState({});
  const total = columns.reduce((sum, column) => sum + column.items.length, 0);
  useEffect(() => {
    if (!focusRequest) return undefined;
    const frame = requestAnimationFrame(() => {
      const items = root.current?.querySelectorAll('[data-kanban-item]') || [];
      const item = [...items].find((node) => node.dataset.kanbanItem === focusRequest.key);
      (item?.querySelector('button') || root.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);
  const find = (key) =>
    columns.flatMap((column) => column.items).find((item) => itemKey(item) === key);
  const drop = (column) => {
    const item = find(dragged);
    setDragged('');
    setOver('');
    if (item && columns.find((entry) => entry.key === column)?.acceptsMove !== false)
      onMove(item, column);
  };
  if (!total)
    return (
      <section ref={root} className="kanban-empty-state" aria-label={label} tabIndex={-1}>
        <div role="status">
          <h2>{emptyTitle}</h2>
          <p>{emptyDetail}</p>
        </div>
        {emptyAction}
      </section>
    );
  return (
    <div
      ref={root}
      className="kanban"
      role="region"
      aria-label={label}
      aria-busy={busy || undefined}
      tabIndex={-1}
    >
      {columns.map((column) => {
        const all = expanded[column.key];
        const shown = all ? column.items : column.items.slice(0, LIMIT);
        const headingId = `${id}-${column.key}`;
        return (
          <section
            key={column.key}
            className={'kanban-column' + (over === column.key ? ' is-over' : '')}
            data-tone={column.tone}
            aria-labelledby={headingId}
            onDragOver={(event) => {
              if (!dragged || column.acceptsMove === false) return;
              event.preventDefault();
              setOver(column.key);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOver('');
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop(column.key);
            }}
          >
            <header className="kanban-column-head">
              <h2 id={headingId}>{column.title}</h2>
              <span className="kanban-count">{column.summary ?? column.items.length}</span>
            </header>
            <div className="kanban-cards">
              {shown.map((item) => {
                const key = itemKey(item);
                return (
                  <KanbanCard
                    key={key}
                    itemId={key}
                    column={column.key}
                    columns={columns}
                    movable={canMove(item)}
                    disabled={busy}
                    moveLabel={moveLabel(item)}
                    menuOpen={menu === key}
                    onMenu={(open) => setMenu(open ? key : '')}
                    onMove={(target) => {
                      setMenu('');
                      onMove(item, target);
                    }}
                    onDragStart={setDragged}
                    onDragEnd={() => {
                      setDragged('');
                      setOver('');
                    }}
                    dragging={dragged === key}
                  >
                    {renderCard(item)}
                  </KanbanCard>
                );
              })}
              {column.items.length > LIMIT && (
                <button
                  type="button"
                  className="kanban-more"
                  aria-expanded={Boolean(all)}
                  onClick={() => setExpanded((current) => ({ ...current, [column.key]: !all }))}
                >
                  {all ? t('kanban.fewer') : t('kanban.showAll', { count: column.items.length })}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
