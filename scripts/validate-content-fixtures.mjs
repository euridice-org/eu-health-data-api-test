// Prove the content fixtures discriminate: every valid document passes the content IG's
// Bundle profile with no errors, and every invalid one fails for the reason the manifest gives.
// Slicing errors are NOT ignored. Runs against the FHIR validator of the ITB setup, which is
// only reachable on the Compose network:
//
//   docker run --rm --network eu-health-data-api-itb_default \
//     --mount type=bind,source="$PWD",target=/work -w /work node:22-alpine \
//     node scripts/validate-content-fixtures.mjs
//
// FHIR_VALIDATOR_URL overrides http://fhir-validator:8080. The validator downloads each content
// IG on first use and checks codes against its terminology server (tx.fhir.org unless the
// validator is configured otherwise), so the first run needs network access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'input/testing/content/fixtures/content-v1');
const base = `${process.env.FHIR_VALIDATOR_URL || 'http://fhir-validator:8080'}/itb`;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const discover = process.argv.includes('--discover');

async function post(endpoint, body) {
  const response = await fetch(base + endpoint, { method: 'POST', signal: AbortSignal.timeout(240000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json().catch(() => null) };
}
const text = (name, value) => ({ name, value, embeddingMethod: 'STRING' });

const loaded = new Set();
const results = [];
let failures = 0;
for (const c of manifest.cases) {
  if (!loaded.has(c.package)) {
    const load = await post('/igManager/process', { operation: 'loadIG', input: [text('ig', c.package)] });
    if (load.status !== 200) throw new Error(`Cannot load ${c.package}: HTTP ${load.status}`);
    loaded.add(c.package);
  }
  const started = Date.now();
  const content = fs.readFileSync(path.join(dir, c.file), 'utf8');
  const { status, json } = await post('/fhir/validate', { input: [text('contentToValidate', content), text('profiles', c.profile)] });
  const outcome = json?.report?.context?.[4]?.value ? JSON.parse(json.report.context[4].value) : null;
  if (status !== 200 || !outcome) throw new Error(`${c.id}: validator answered HTTP ${status} without a report`);
  const errors = outcome.issue.filter(i => ['error', 'fatal'].includes(i.severity));
  const messages = errors.map(i => `${i.details?.text ?? i.diagnostics ?? ''} @ ${(i.expression ?? []).join(',')}`);
  let verdict = 'ok';
  if (c.expect === 'valid' && errors.length) verdict = `expected no errors, got ${errors.length}`;
  if (c.expect === 'invalid') {
    if (!errors.length) verdict = 'expected errors, got none';
    else if (c.expectedIssue && !messages.some(m => m.includes(c.expectedIssue))) verdict = `no error mentions "${c.expectedIssue}"`;
  }
  if (verdict !== 'ok' && !discover) failures++;
  results.push({ id: c.id, expect: c.expect, errors: errors.length, verdict, firstErrors: messages.slice(0, 3) });
  console.log(`${verdict === 'ok' || discover ? 'ok  ' : 'FAIL'} ${c.id}: ${errors.length} errors (${((Date.now() - started) / 1000).toFixed(0)}s)${verdict === 'ok' ? '' : ' - ' + verdict}`);
  if (discover || verdict !== 'ok') for (const m of messages.slice(0, 3)) console.log(`       ${m.slice(0, 200)}`);
}
const out = path.join(root, 'itb/build/content-validation');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ fixtureSet: manifest.fixtureSet, results }, null, 2) + '\n');
if (failures) { console.error(`${failures} of ${results.length} fixtures do not behave as the manifest says`); process.exit(1); }
console.log(`${results.length} fixtures behave as the manifest says.`);
