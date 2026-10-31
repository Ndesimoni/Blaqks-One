import React, { useEffect, useId, useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Icon } from '../Icon.jsx';
import './kanban-card.css';

/**
 * One draggable card. Its body (children) opens the record; the ⋯ button opens a list of
 * the other columns, so moving works by keyboard and touch as well as by dragging. The
 * list closes on Escape (focus returns to ⋯) or a click outside.
 */
export function KanbanCard({
  children,
  itemId,
  column,
  columns,
  movable,
  moveLabel,
  menuOpen,
  onMenu,
  onMove,
  onDragStart,
  onDragEnd,
  dragging,
}) {
  const { t } = useI18n();
  const id = useId();
  const root = useRef(null);
  const button = useRef(null);
  const menuId = `${id}-move`;
  useEffect(() => {
    if (!menuOpen) return undefined;
    const outside = (event) => !root.current?.contains(event.target) && onMenu(false);
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onMenu(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    root.current?.addEventListener('keydown', escape);
    const node = root.current;
    return () => {
      document.removeEventListener('pointerdown', outside);
      node?.removeEventListener('keydown', escape);
    };
  }, [menuOpen, onMenu]);
  return (
    <article
      ref={root}
      data-kanban-item={itemId}
      className={'kanban-card' + (dragging ? ' is-dragging' : '')}
      draggable={movable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', itemId);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(itemId);
      }}
      onDragEnd={onDragEnd}
    >
      {children}
      {movable && (
        <button
          type="button"
          ref={button}
          className="kanban-card-move"
          aria-label={moveLabel}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => onMenu(!menuOpen)}
        >
          <Icon name="more" size={16} />
        </button>
      )}
      {movable && menuOpen && (
        <div className="kanban-move-menu" id={menuId} role="group" aria-label={t('kanban.moveTo')}>
          {columns.map((target) => (
            <button
              type="button"
              key={target.key}
              disabled={target.key === column || target.acceptsMove === false}
              aria-current={target.key === column ? 'true' : undefined}
              onClick={() => onMove(target.key)}
            >
              <span className="kanban-tone" data-tone={target.tone} aria-hidden="true" />
              {target.title}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
