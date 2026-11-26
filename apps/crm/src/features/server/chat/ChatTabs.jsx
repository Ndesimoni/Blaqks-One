import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

export const CHAT_KINDS = ['all', 'channel', 'direct', 'group'];

/**
 * All, Channels, Direct and Groups across the top of Team chat, as the approved mockup's
 * header tabs; each shows that part of the room list (review finding 12).
 */
export function ChatTabs({ kind, onKind }) {
  const { t } = useI18n();
  return (
    <div role="tablist" aria-label={t('chat.tabs.label')} className="chat-top-tabs">
      {CHAT_KINDS.map((name) => (
        <button
          key={name}
          type="button"
          role="tab"
          aria-selected={kind === name}
          className={kind === name ? 'is-active' : undefined}
          onClick={() => onKind(name)}
        >
          {t(`chat.tabs.${name}`)}
        </button>
      ))}
    </div>
  );
}
