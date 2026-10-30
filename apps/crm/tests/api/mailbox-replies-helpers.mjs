/** Client replies through the Google stand-in's pretend mailboxes (E1c). */
import { query } from './helpers.mjs';
import { google } from './mailbox-helpers.mjs';

export const deliver = async (to, mail) =>
  (
    await fetch(`${google}/test/deliver`, { method: 'POST', body: JSON.stringify({ to, ...mail }) })
  ).json();

const pause = () => new Promise((resolve) => setTimeout(resolve, 200));

/** Polls `sql` until it returns something other than '' (the worker syncs every second). */
export async function eventually(sql) {
  for (let tries = 0; tries < 100; tries += 1) {
    const value = query(sql);
    if (value) return value;
    await pause();
  }
  return '';
}

/** Waits until a message with `text` is stored in `thread`; returns its row values. */
export const imported = (thread, text, columns = 'm.body') =>
  eventually(
    `SELECT ${columns} FROM inbox.crm_inbox_messages m JOIN inbox.crm_inbox_conversations c
     ON c.id=m.conversation_id WHERE c.external_thread_id='${thread}' AND m.body='${text}'`,
  );
