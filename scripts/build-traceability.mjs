// Build or check the requirement traceability matrix. No server access.
//   node scripts/build-traceability.mjs           write matrix.json and matrix.md
//   node scripts/build-traceability.mjs --check   fail if they are stale or the mapping is incomplete
import fs from 'node:fs';
import path from 'node:path';
import { buildMatrix, renderMarkdown, traceabilityDir } from './lib/traceability.mjs';

const matrix = buildMatrix();
const outputs = {
  'matrix.json': JSON.stringify(matrix, null, 2) + '\n',
  'matrix.md': renderMarkdown(matrix),
};
let stale = false;
for (const [name, content] of Object.entries(outputs)) {
  const file = path.join(traceabilityDir, name);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`${name} is stale: run node scripts/build-traceability.mjs`);
      stale = true;
    }
  } else {
    fs.writeFileSync(file, content);
  }
}
if (stale) process.exit(1);
const untested = Object.entries(matrix.requirements).filter(([, r]) => !r.scenarios.length).map(([id]) => id);
console.log(`${Object.keys(matrix.scenarios).length} scenarios, ${Object.keys(matrix.requirements).length} requirements; without a test: ${untested.join(', ') || 'none'}`);
