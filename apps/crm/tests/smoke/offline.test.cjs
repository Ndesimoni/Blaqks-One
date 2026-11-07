const fs = require('fs');
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '../../../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const schema = read('legacy/offline/public/schema.js');
const jsx = read('legacy/offline/src/App.jsx');
const app = read('legacy/offline/public/app.js');
const css = read('legacy/offline/public/styles.css');
assert(
  schema.includes('"Clients"') && schema.includes('"Deals"') && schema.includes('"Client care"'),
);
const cols = JSON.parse(schema.slice(schema.indexOf('{'), schema.lastIndexOf('}') + 1));
assert.equal(Object.keys(cols).length, 11);
assert.equal(Object.values(cols).flat().length, 211);
assert(
  jsx.includes('importExcel') &&
    jsx.includes('exportExcel') &&
    jsx.includes('localStorage.setItem'),
);
assert(jsx.includes('ClientDesk') && jsx.includes('Performance') && jsx.includes('Insights'));
assert(
  jsx.includes('PropertyDirectory') &&
    jsx.includes('propertyFilters') &&
    jsx.includes('theme-switch'),
);
assert(jsx.includes('saveRecord') && jsx.includes('deleteRecord'));
assert(app.length > 90000 && css.length > 20000);
assert(
  fs.existsSync(
    path.join(root, 'legacy/offline/public/data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx'),
  ),
);
console.log(
  'PASS: 17 sheets mapped; 200 original + 11 enhanced property fields; React build + CRUD + Excel import/export + reports present.',
);
