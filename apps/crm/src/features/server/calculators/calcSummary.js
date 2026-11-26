/**
 * The plain-text summary a calculator copies or sends to a client: its title, what was
 * entered, the result lines and the estimate note. Rows give `text` when their shown value is
 * not plain text.
 */
export function calcSummary({ title, inputs, rows, note }) {
  const line = (label, value) => `${label}: ${value}`;
  return [
    title,
    ...inputs.map(([label, value]) => line(label, value)),
    '',
    ...rows.map((row) => line(row.label, row.text ?? row.value)),
    '',
    note,
  ].join('\n');
}
