/**
 * CSV lines for downloads opened in spreadsheets: every cell quoted, quotes doubled, and text
 * that starts like a formula (= + - @ or a control character) kept as plain text.
 */
const inert = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
const cell = (value) => `"${inert(String(value ?? '')).replaceAll('"', '""')}"`;

export const csvLine = (values) => values.map(cell).join(',');
