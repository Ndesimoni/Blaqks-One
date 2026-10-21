# Team chat

Packets C1 (server) and C2 (screen), built 2026-10-21. Colleagues in one company talk in
team channels and private one-to-one conversations. This is internal chat; client
conversations stay in the [Inbox](messaging-design.md).

## Owner decisions (2026-10-21)

- **Private stays private.** A direct conversation is readable only by its two members.
  The company Admin cannot open it, and the Super Admin reads no company chat at all,
  including in the read-only archive views.
- **The Admin creates channels.** Every member of the company can read and post in every
  channel. Each company gets **#general** the first time anyone opens chat.

## How it works

- Module `chat/` owns schema `chat` (migration 0041): rooms (`channel` with a lower-case
  name, or `direct` with the sorted pair of member IDs), participants (direct only),
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

## API

All under `/api/crm/workspaces/{workspace}/chat`, with the session, and Origin and CSRF on
writes: `GET /` (rooms, colleagues, `canCreateChannel`), `GET /summary`, `POST /channels`,
`POST /direct`, `GET|POST /rooms/{id}/messages` (`?before=` for earlier pages),
`PATCH|DELETE /rooms/{id}/messages/{message}`, `POST /rooms/{id}/read`.

## Decided for now, and later

- Edits replace the text without keeping earlier versions (security review C1 L2,
  accepted as privacy-friendly); revisit if the owner wants an edit history.
- Photos and files: up to 10 per message through [private file storage](media-storage.md)
  (F1, 2026-10-21); served only to members who may see the room.
- Later packets: mentions and notifications, group conversations, WebSockets in place of polling, translation of messages, retention
  periods, and deal rooms between companies with locked messages (product vision §3).
