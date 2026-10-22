# Saved replies and drafts (packet N2)

Status: designed 2026-10-22 from the owner's decisions in
[Product decisions](product-decisions.md), with a separate security review of the design
(§7) and the product designer's spec (§5). N2a (server) is built; N2b (screens) follows.
Owned by the `inbox` module (schema `inbox`), like internal notes and lead rules. English
only ([English only](product-decisions.md#english-only-decided-2026-10-22)).

## 1. What members get

- **Saved replies:** ready-made text such as "Thanks for your enquiry, here are the
  details…". The Admin keeps **company** saved replies that every member can use; each member
  keeps **their own** private ones. Choosing one puts its text into the message box, where it
  can still be edited before sending.
- **Fill-ins:** `{client name}`, `{my name}` and `{company}` in a saved reply are replaced
  when it is used: the conversation's contact name (or, in New email, the chosen recipient's
  name), the member's own name and the company name. A fill-in with no value stays as typed,
  so the member sees it and edits it before sending. Matching ignores letter case.
- **Drafts:** a reply typed but not sent is saved by itself and is there again when the
  member comes back to the conversation, on any device. Only its writer ever sees it. Files
  are not kept with a draft (an upload not sent is removed after 24 hours, F1).

## 2. Data

`inbox.crm_inbox_saved_replies`: `id`, `workspace_id`, `owner_user_id` (NULL for a company
reply), `title` (1–80 characters), `body` (1–5,000), `version`, `created_by`, `updated_by`,
`created_at`, `updated_at`. A title is unique per company list and per member list, ignoring
case. At most 200 company replies per company and 100 personal replies per member.

`inbox.crm_inbox_drafts`: one row per (`conversation_id`, `member_id`), with `workspace_id`,
`body` (1–20,000, the reply limit, or empty), `revision` and `updated_at`; removed with its
conversation. At most 300 drafts with text per member; a draft the member already has can
always be saved. Reply text
exists in `crm_inbox_messages`; a draft is the only other place unsent reply text is kept,
and it never reaches activity, logs or another member.

## 3. Access

Every route runs the Inbox's member check (company members only, never the Super Admin).
Saved-reply writes take the workspace lock and re-read the live member after it, as notes
do. **Drafts do not take the lock** (review M2): an autosave every second must not queue
behind sends and record writes for the whole company. The live member and the
conversation's visibility are read in the save's own transaction and checked again on every
read, so a draft written during an archive or reassignment is never shown to anyone.

| Action                             | Who                                                          |
| ---------------------------------- | ------------------------------------------------------------ |
| List saved replies                 | Any company member: the company list and their own list only |
| Add, edit, remove a company reply  | The company Admin                                            |
| Add, edit, remove a personal reply | Its owner only                                               |
| Read or save a draft               | Its writer, on a conversation they can currently see         |

Another member's personal reply, a company reply for anyone but the Admin, another
company's reply, a guessed ID and a draft on a conversation the member cannot see all give
the same not-found, checked before the version (review M3). Edits and removals carry the
reply's `version` and fail with "Reload" when it changed.

**A sent reply never comes back as a draft** (review H1). Every save names the revision it
builds on and is refused when the draft has moved on. Sending a reply empties its writer's
draft and moves its revision on in the send transaction, so an autosave already on its way,
or one from another device, is refused instead of restoring text that was sent. Only the
reply route does this; Send again and New email have no draft.

A departed or archived member's personal replies and drafts stay stored but are never shown
to anyone, including the Super Admin's read-only archive views, and never go into exports,
backups or data migration (review L2). Removing drafts after about 30 days is needed before
hosting.

## 4. API

Under `/api/crm/workspaces/{workspace}/inbox`:

- `GET /saved-replies` → `{company: [...], mine: [...], canManageCompany}`, each item
  `{id, title, body, version}`, sorted by title.
- `POST /saved-replies` `{scope: "company" | "mine", title, body}` → 201 with the item.
- `PATCH /saved-replies/{id}` `{expectedVersion, title, body}`; `POST
/saved-replies/{id}/remove` `{expectedVersion}`.
- `GET /conversations/{id}/draft` → `{draft: {body, revision}}` (`body` null and `revision`
  0 when there is none); `PUT /conversations/{id}/draft` `{body, baseRevision}` → `{revision}`,
  blank text empties it, and a stale revision gives 409. A reply's response carries
  `draftRevision`.

Bodies are exact (unknown keys refused), trimmed titles, plain text only; zero-width and
text-direction marks are refused in saved replies (review L3). The screen shows saved text
only as text, never as HTML.

## 5. Screens (product designer, 2026-10-22)

- **Button:** inside the typing box on its end side (like WhatsApp's in-box icons), so the
  row stays "+ | box | Send" and the box keeps its width on phones; a 32px round button
  (40px on phones) named "Saved replies". Only on the Inbox Reply tab and New email.
- **Picker:** a popover above the button (a bottom sheet on phones) with search, "Company"
  then "Mine" sections in one continuously scrolling list, and "Manage saved replies" at the
  end; arrow keys, Enter and Escape work, and focus returns to the box. Choosing a reply
  fills it in and replaces an empty box, or goes in at the cursor on a new line.
- **Fill-ins** are replaced in one pass, ignoring case. `{client name}` uses the linked
  client's name when the member can see it; otherwise the conversation's contact name with
  invisible and direction marks removed, on one line of at most 60 characters, and it stays
  as typed when that name looks like an address, link or long number (review M1).
- **Manage saved replies:** a dialog with Company and Mine tabs; members see the company list
  read-only. Add and edit replace the list with a form (Title, Text, fill-in chips, and for
  the Admin "Everyone in the company" or "Only me"); removing asks first.
- **Drafts:** saved about a second after typing stops, on switching conversation or tab, and
  when the page closes (a `keepalive` request with the usual CSRF check, review M4); never
  kept in browser storage. The line under the box says "Draft saved" or "Draft not saved ·
  Try again". Sending first cancels a waiting save and waits for one already on its way.

## 6. Not in this packet

Saved replies with files; a `/` shortcut in the box; drafts for New email and internal notes;
removing old drafts after a time; showing changes to company replies in Team activity.

## 7. Security review of the design (2026-10-22)

One High (H1, a sent reply restored by a late autosave) and four Medium findings (M1 contact
names in fill-ins, M2 drafts and the company lock, M3 check order, M4 saving on leave); all
are written into §2–§5 above, with the Low ones (L1 draft limit, L2 exports and age, L3
invisible marks).
