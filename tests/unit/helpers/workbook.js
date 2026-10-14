import assert from 'node:assert/strict';
import { exportExcel, importExcel } from '../../../src/lib/excel.js';
import { TestDOMParser } from './xml-dom.js';

/** Export through the real workbook writer, capturing the download instead of saving it. */
export async function exportWorkbook(data) {
  let blob;
  const previous = { document: globalThis.document, create: URL.createObjectURL };
  globalThis.document = {
    createElement: () => ({ click() {}, remove() {} }),
    body: { appendChild() {} },
  };
  URL.createObjectURL = (value) => {
    blob = value;
    return 'blob:test';
  };
  try {
    await exportExcel(data, () => {});
  } finally {
    globalThis.document = previous.document;
    URL.createObjectURL = previous.create;
  }
  assert.ok(blob, 'the workbook was exported');
  return blob;
}

/** Import workbook bytes through the real reader with the test XML parser. */
export async function importWorkbook(bytes, name = 'workbook.xlsx') {
  globalThis.DOMParser = TestDOMParser;
  try {
    return await importExcel(new File([bytes], name));
  } finally {
    delete globalThis.DOMParser;
  }
}
