/** Repeats further apart than this start a new row. */
export const REPEAT_WINDOW_MS = 10 * 60_000;

/**
 * What a repeat must share with the row it joins: the actor, the action and its target — the
 * record, the collection when the record is unavailable, the team member or the channel.
 */
export function repeatKey(item) {
  const target =
    item.kind === 'team'
      ? `member:${item.member?.id || ''}`
      : item.kind === 'channel'
        ? `channel:${item.channel}`
        : item.record
          ? `record:${item.collection}:${item.record.id}`
          : `collection:${item.collection}`;
  return `${item.actor.id}|${item.kind}|${item.action}|${target}`;
}

/**
 * Collapses consecutive repeats (server order, newest first) into rows. A repeat joins the row
 * above when it shares its `repeatKey` and falls within 10 minutes of that row's newest entry.
 * Every item appears exactly once, so recomputing after Load more never duplicates a row, and
 * each row keeps its newest entry's ID as a stable key.
 */
export function groupRepeats(items, windowMs = REPEAT_WINDOW_MS) {
  const rows = [];
  for (const item of items) {
    const key = repeatKey(item);
    const row = rows.at(-1);
    const time = Date.parse(item.at);
    if (row && row.key === key && Date.parse(row.item.at) - time <= windowMs) {
      row.items.push(item);
      continue;
    }
    rows.push({ id: item.id, key, item, items: [item] });
  }
  return rows;
}

/** "7 times". */
export const repeatCount = (count) => `${count} times`;
