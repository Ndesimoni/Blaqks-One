/** Spreadsheet column letter for a zero-based index: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index) {
  let letters = '';
  for (let position = index + 1; position; position = Math.floor((position - 1) / 26))
    letters = String.fromCharCode(65 + ((position - 1) % 26)) + letters;
  return letters;
}

/**
 * Workbook columns are contiguous from A in the listed order. Excel import and export map
 * values by these letters, so new fields are only ever appended to the end of a sheet.
 */
export function sheetColumns(names) {
  return names.map((name, index) => ({ col: columnLetter(index), name }));
}
