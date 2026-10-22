# Team chat

Packets C1 (server) and C2 (screen), built 2026-10-21; C3 (groups and mentions), built
2026-10-22. Colleagues in one company talk in team channels, private one-to-one
conversations and private groups. This is internal chat; client conversations stay in the
[Inbox](messaging-design.md).

## Owner decisions (2026-10-21)

- **Private stays private.** A direct conversation is readable only by its two members.
  The company Admin cannot open it, and the Super Admin reads no company chat at all,
  including in the read-only archive views.
- **The Admin creates channels.** Every member of the company can read and post in every
  channel. Each company gets **#general** the first time anyone opens chat.

## How it works

- Module `chat/` owns schema `chat` (migration 0041): rooms (`channel` with a lower-case
  name, or `direct` with the sorted pair of member IDs), participants (direct and group rooms),
  messages and read marks. There are no foreign keys into CRM tables, and message bodies
  never leave the schema: no activity entry, log or export carries them.
- Every request is a live member of the company: archived, suspended and frozen-team
  members lose chat immediately. Writes re-check membership under the company's lock.
- Messages are 1–4,000 characters of plain text, shown as text, never as markup. Authors
  may edit (shown as "edited") or delete (the message keeps its place as "deleted"); the
  Admin may delete others' messages in channels, never in private conversations.
- A member may send at most 30 messages a minute (security review C1 L1).
- Unread counts per room and a total on the sidebar. The screen polls: rooms every 5
  seconds, the open room every 4 seconds, the sidebar badge every 15 seconds.
- A colleague who leaves keeps their place in the other person's private conversation,
  which stays readable to that person but cannot be answered.

## Groups and mentions (C3, as built 2026-10-22)

Defaults assumed from the owner's chat decisions above, for the owner to confirm:

- **Groups.** Any member may start a private group with 2–20 live colleagues of the same
  company plus themselves, with an optional name of up to 60 characters (blank shows the
  members' names). Only its participants read or post: the Admin cannot open a group they
  are not in (not-found, like a guessed ID), and the Super Admin reads none. Members are
  chosen at creation; there is no adding later. Any participant may leave (their messages
  keep their place; they lose the room, its read mark and their mentions in it). A
  colleague who leaves the company stays listed, shown as "Former team member", and loses
  the group at once. A member may start at most 20 groups an hour.
- **Mentions.** In channels and groups, typing `@` suggests the colleagues who can see the
  room; choosing one inserts `@Name`. The message carries the mentioned member IDs
  (`mentions`, at most 20, distinct); the server checks under the company lock that each is
  a live member who can see the room (any member for a channel, a live participant for a
  group) and refuses the message otherwise. Names are never parsed from the text: the
  thread highlights `@Name` only for the stored IDs. Direct conversations take no
  mentions. An edit may replace the mentions (the screen keeps those whose `@Name` is
  still in the text); a deletion removes them.
- **Notification, in the app only.** A mention counts until the member reads the room: an
  `@count` on the room and on the Team chat sidebar badge (which otherwise shows the unread
  count), and the message highlighted with "Mentions you". Own messages never count. No
  email or push.
- Schema: migration 0055 adds the room kind `group`, an optional `title`, and
  `chat.crm_chat_mentions` (message, room, member; no foreign keys into CRM tables). Group
  participants use `crm_chat_participants` as direct conversations do, so the existing
  visibility rule covers groups unchanged.

## API

All under `/api/crm/workspaces/{workspace}/chat`, with the session, and Origin and CSRF on
writes: `GET /` (rooms with `unread`, `mentions`, and for groups `title` and `members`;
colleagues; `canCreateChannel`), `GET /summary` (`unread`, `mentions`), `POST /channels`,
`POST /direct`, `POST /groups` (`memberIds`, optional `name`), `GET|POST
/rooms/{id}/messages` (`?before=` for earlier pages; a sent message may carry
`mentions`; every message lists its `mentions`), `PATCH|DELETE
/rooms/{id}/messages/{message}` (`PATCH` may carry `mentions`), `POST /rooms/{id}/read`,
`POST /rooms/{id}/leave` (groups only).

## Decided for now, and later

- Edits replace the text without keeping earlier versions (security review C1 L2,
  accepted as privacy-friendly); revisit if the owner wants an edit history.
- Photos and files: up to 10 per message through [private file storage](media-storage.md)
  (F1, 2026-10-21); served only to members who may see the room.
- Later packets: adding members to a group, email or push notifications for mentions,
  WebSockets in place of polling, translation of messages, retention periods, and deal
  rooms between companies with locked messages (product vision §3).
