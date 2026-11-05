import JSZip from 'jszip';
import { MODS, blank, schema } from './schema.js';
import { valueOf, leadTier, yourFee } from './crm.js';
import { SUM, amountOf, get, isDone } from './records.js';
import { monthOf, today } from './dates.js';
import { downloadBlob } from '../services/files/download.js';
import { rollingMonths } from '../features/reports/selectors.js';

/* Read workbook sheet rows from spreadsheet OOXML. Values are mapped by column letters,
   so import does not depend on potentially edited human-readable header text. */
async function importExcel(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const elements = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
  const parse = (xml) => {
    const document = parser.parseFromString(xml, 'application/xml');
    if (elements(document, 'parsererror').length) throw Error('The workbook contains invalid XML.');
    return document;
  };
  const read = async (path) => {
    const entry = zip.file(path);
    if (!entry) throw Error(`The workbook is missing ${path}.`);
    return parse(await entry.async('string'));
  };
  const book = await read('xl/workbook.xml');
  const relationships = await read('xl/_rels/workbook.xml.rels');
  const rels = {};
  for (const v of elements(relationships, 'Relationship'))
    rels[v.getAttribute('Id')] = v.getAttribute('Target');
  const shared = [];
  const stringFile = zip.file('xl/sharedStrings.xml');
  if (stringFile) {
    const doc = parse(await stringFile.async('string'));
    for (const si of elements(doc, 'si'))
      shared.push(
        elements(si, 't')
          .map((t) => t.textContent)
          .join(''),
      );
  }
  const output = blank();
  let matchedSheets = 0;
  for (const sh of elements(book, 'sheet')) {
    const name = sh.getAttribute('name');
    if (!MODS[name]) continue;
    const rid =
      sh.getAttribute('r:id') ||
      sh.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id',
      );
    const target = rels[rid];
    if (!target) throw Error(`The ${name} worksheet could not be located.`);
    const segments = (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/');
    const resolved = [];
    for (const segment of segments) {
      if (segment === '..') resolved.pop();
      else if (segment !== '.') resolved.push(segment);
    }
    const doc = await read(resolved.join('/'));
    matchedSheets++;
    const fields = schema(name);
    for (const row of elements(doc, 'row')) {
      if (Number(row.getAttribute('r')) < 6) continue;
      const entry = {};
      for (const cell of elements(row, 'c')) {
        const ref = cell.getAttribute('r');
        const col = ref?.match(/^[A-Z]+/)?.[0];
        const f = fields.find((x) => x.col === col);
        if (!f || f.calculated) continue;
        const vNode = Array.from(cell.childNodes).find(
          (n) => n.localName === 'v' || n.localName === 'is',
        );
        if (!vNode) continue;
        let v = vNode.textContent || '';
        if (cell.getAttribute('t') === 's') {
          if (shared[Number(v)] === undefined)
            throw Error('The workbook contains an invalid shared string.');
          v = shared[Number(v)];
        } else if (cell.getAttribute('t') === 'inlineStr')
          v = elements(cell, 't')
            .map((text) => text.textContent)
            .join('');
        if (!v) continue;
        if (f.type === 'date' || f.type === 'datetime-local') {
          if (/^\d+(\.\d+)?$/.test(String(v))) {
            const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v) * 86400000));
            v = dt.toISOString().slice(0, f.type === 'date' ? 10 : 16);
          } else if (f.type === 'date') v = String(v).slice(0, 10);
        } else if (f.type === 'number') {
          if (!Number.isFinite(Number(v)))
            throw Error(`${name}: ${f.name} contains an invalid number.`);
          v = Number(v);
        }
        entry[f.key] = v;
      }
      if (entry[fields[0]?.key]) output[name].push(entry);
    }
  }
  if (!matchedSheets)
    throw Error('No matching CRM worksheets were found. Use the Keys with Simoni template.');
  return output;
}

/* Construct an Office Open XML workbook client-side. Summary sheets are snapshot views;
   data sheets retain all original fields and append new property-rate fields while keeping 17 sheet names. */
async function exportExcel(data, notify) {
  try {
    const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    const names = [
      'Dashboard',
      'Deals',
      'Clients',
      'Contacts',
      'Properties',
      'Follow-ups',
      'Viewings',
      'Payments',
      'Expenses',
      'Guide',
      'Shortlist',
      'Client desk',
      'Date search',
      'Performance',
      'Interaction log',
      'Client care',
      'CRM insights',
    ];
    const cell = (v, col, row) => {
      if (v === undefined || v === null || v === '') return '';
      const n = typeof v === 'number' && !Number.isNaN(v);
      return `<c r="${col}${row}"${n ? '' : ' t="inlineStr"'}>${n ? `<v>${v}</v>` : `<is><t>${esc(v)}</t></is>`}</c>`;
    };
    const colLetter = (n) => {
      let s = '';
      for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      return s;
    };
    const worksheet = (rows) => {
      const content = rows
        .map(
          (cells, i) =>
            `<row r="${i + 1}">${cells.map((v, j) => cell(v, colLetter(j), i + 1)).join('')}</row>`,
        )
        .join('');
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${content}</sheetData></worksheet>`;
    };
    const zip = new JSZip();
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    );
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((n, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    );
    zip.file(
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${esc(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((n, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    );
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      let rows = [];
      if (MODS[name]) {
        const fields = schema(name);
        rows = [
          [`KEYS WITH SIMONI · ${name.toUpperCase()}`],
          ['Exported from React CRM — field names mirror the original workbook'],
          [],
          [],
          fields.map((f) => f.name),
          ...(data[name] || []).map((r) => fields.map((f) => valueOf(data, name, r, f) ?? '')),
        ];
      } else if (name === 'Dashboard')
        rows = [
          ['KEYS WITH SIMONI — Dashboard'],
          ['Report generated', new Date().toISOString()],
          ['Active leads', data.Clients.filter((c) => !isDone(get(c, 'Lead stage'))).length],
          ['Active deals', data.Deals.filter((d) => !isDone(get(d, 'Deal stage'))).length],
          [
            'Commission receipts AED',
            SUM(data.Payments, (p) => amountOf(p, 'Your fee received AED ex VAT')),
          ],
          ['Expenses AED', SUM(data.Expenses, (p) => amountOf(p, 'Amount paid AED'))],
        ];
      else if (name === 'CRM insights')
        rows = [
          ['KEYS WITH SIMONI — CRM insights'],
          ['Lead tier', 'Count'],
          ...['Hot', 'Warm', 'Nurture', 'Converted', 'Lost'].map((t) => [
            t,
            data.Clients.filter((c) => leadTier(c) === t).length,
          ]),
        ];
      else if (name === 'Performance')
        rows = [
          ['KEYS WITH SIMONI — Performance'],
          ['Month', 'New enquiries', 'Closed deals', 'Earned fees AED'],
          ...rollingMonths(12)
            .reverse()
            .map((m) => {
              return [
                m,
                data.Clients.filter((c) => monthOf(get(c, 'Date added')) === m).length,
                data.Deals.filter((c) => monthOf(get(c, 'Closed date')) === m).length,
                SUM(
                  data.Deals.filter((c) => monthOf(get(c, 'Earned date')) === m),
                  yourFee,
                ),
              ];
            }),
        ];
      else if (name === 'Client desk')
        rows = [
          ['KEYS WITH SIMONI — Client search'],
          ['Client ID', 'Full name', 'Phone', 'Lead stage', 'Budget'],
          ...data.Clients.map((c) => [
            get(c, 'Client ID'),
            get(c, 'Full name'),
            get(c, 'Phone'),
            get(c, 'Lead stage'),
            get(c, 'Maximum budget AED'),
          ]),
        ];
      else if (name === 'Date search')
        rows = [
          ['KEYS WITH SIMONI — Date search'],
          ['Record type', 'Record ID', 'Date'],
          ...data.Clients.map((c) => ['New enquiries', get(c, 'Client ID'), get(c, 'Date added')]),
          ...data.Viewings.map((c) => [
            'Viewings',
            get(c, 'Viewing ID'),
            get(c, 'Appointment date & time'),
          ]),
        ];
      else if (name === 'Guide')
        rows = [
          ['KEYS WITH SIMONI — Quick guide'],
          ['1. Create contacts and property listings'],
          ['2. Record your clients and qualification details'],
          ['3. Schedule follow-ups and viewings'],
          ['4. Manage deal pipelines and commissions'],
          ['5. Record receipts and expenses'],
          ['6. Maintain your client-care program'],
          [
            'For photos and floor plans, use the full JSON backup because Excel only exports listing text.',
          ],
        ];
      zip.file(`xl/worksheets/sheet${i + 1}.xml`, worksheet(rows));
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, `Keys_with_Simoni_CRM_${today()}.xlsx`);
    notify('Excel workbook exported successfully');
  } catch (e) {
    console.error(e);
    alert('Excel export failed. Please try again.');
  }
}

export { importExcel, exportExcel };
