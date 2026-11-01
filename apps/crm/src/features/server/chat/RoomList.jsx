import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { roomTitle, splitRooms } from './chatModel.js';
import { NewConversation } from './NewConversation.jsx';
import { NewGroup } from './NewGroup.jsx';
import { RoomRow } from './RoomRow.jsx';

/**
 * Channels, groups and direct messages, with New channel (the Admin), New group and New
 * message; `kind` (the top tabs) shows one part, and the search narrows the rooms by name.
 */
export function RoomList({ chat, selectedId, onOpen, kind = 'all' }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(null);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matching = (rooms) =>
    rooms.filter(
      (room) => !needle || roomTitle(room, chat.people, t).toLowerCase().includes(needle),
    );
  const { channels, groups, direct } = splitRooms(chat.rooms);
  const shows = (part) => kind === 'all' || kind === part;
  const opened = (result) => {
    if (result.error) return result.error;
    setMode(null);
    onOpen(result.room.id);
    return '';
  };
  if (mode)
    return (
      <section className="chat-list" aria-label={t('chat.rooms')}>
        {mode === 'group' ? (
          <NewGroup
            people={chat.people}
            onCreate={async (ids, name) => opened(await chat.createGroup(ids, name))}
            onCancel={() => setMode(null)}
          />
        ) : (
          <NewConversation
            mode={mode}
            people={chat.people}
            onChannel={async (name) => opened(await chat.createChannel(name))}
            onDirect={async (id) => opened(await chat.openDirect(id))}
            onCancel={() => setMode(null)}
          />
        )}
      </section>
    );
  const group = (title, rooms, action) => (
    <div className="chat-group">
      <div className="chat-group-head">
        <h2>{title}</h2>
        {action}
      </div>
      <ul>
        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            people={chat.people}
            selected={room.id === selectedId}
            onOpen={onOpen}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
  const add = (key, next) => (
    <Button
      variant="light"
      icon="plus"
      className="chat-add"
      aria-label={t(key)}
      title={t(key)}
      onClick={() => setMode(next)}
    />
  );
  return (
    <section className="chat-list" aria-label={t('chat.rooms')}>
      <label className="chat-search">
        <span className="sr-only">{t('chat.search')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('chat.search')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {shows('channel') &&
        group(
          t('chat.channels'),
          matching(channels),
          chat.canCreateChannel && add('chat.newChannel', 'channel'),
        )}
      {shows('group') && group(t('chat.groups'), matching(groups), add('chat.newGroup', 'group'))}
      {shows('direct') &&
        group(t('chat.direct'), matching(direct), add('chat.newMessage', 'direct'))}
    </section>
  );
}
