import { recordDetailFields, recordFormSections } from '../formSections.js';

const ADDITIONAL = 'additional';

/**
 * Record details grouped like the editor: its named sections in form order, the editor's
 * ten-field chunks of unplaced fields joined into one group, then calculated fields under
 * `calculatedTitle`. Every workbook field appears exactly once; scheduling fields kept only
 * in the browser stay out, as they did in the details grid.
 */
export function factSections(module, calculatedTitle) {
  const remaining = new Map(recordDetailFields(module).map((field) => [field.key, field]));
  const sections = [];
  for (const { id, title, fields } of recordFormSections(module)) {
    const shown = fields.flatMap((field) => {
      const detail = remaining.get(field.key);
      remaining.delete(field.key);
      return detail ? [detail] : [];
    });
    const chunk = id.startsWith(`${ADDITIONAL}-`);
    if (chunk && sections.at(-1)?.id === ADDITIONAL) sections.at(-1).fields.push(...shown);
    else sections.push({ id: chunk ? ADDITIONAL : id, title, fields: shown });
  }
  if (remaining.size)
    sections.push({ id: 'calculated', title: calculatedTitle, fields: [...remaining.values()] });
  return sections.filter((section) => section.fields.length);
}
