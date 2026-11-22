// Collect the compiled test suites into a versioned, checksummed release folder.
//
//   npm run --prefix itb compile && node itb/release.mjs
//
// Output: itb/build/release/ with one deployable suite ZIP per feature, SHA256SUMS,
// release.json and the traceability matrix. The ZIPs are byte-for-byte reproducible,
// so the same sources always give the same checksums.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { traceabilityDir } from '../scripts/lib/traceability.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(root);
const build = path.join(root, 'build');
const out = path.join(build, 'release');

const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const version = read('sushi-config.yaml').match(/^version:\s*(\S+)/m)?.[1];
const itb = read('docker-compose.yml').match(/image: isaitb\/gitb-srv:([\d.]+)/)?.[1];
if (!version || !itb) throw new Error('Cannot read the IG version or the ITB version');
const dependency = name => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const manifest = JSON.parse(fs.readFileSync(path.join(build, 'manifest.json'), 'utf8'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const sums = [];
const suites = manifest.map(suite => {
  const bytes = fs.readFileSync(path.join(build, suite.archive));
  const file = `${path.basename(suite.feature, '.feature')}-${version}.zip`;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(out, file), bytes);
  sums.push(`${sha256}  ${file}`);
  return { file, sha256, actor: suite.actor, feature: suite.feature, testCases: suite.testCases.length };
});
for (const name of ['matrix.json', 'matrix.md']) fs.copyFileSync(path.join(traceabilityDir, name), path.join(out, name));
fs.writeFileSync(path.join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
const matrix = JSON.parse(fs.readFileSync(path.join(out, 'matrix.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({
  version,
  commit: git('rev-parse', 'HEAD'),
  uncommittedChanges: git('status', '--porcelain', '--', 'input', 'itb', 'scripts', 'docker-compose.yml', 'sushi-config.yaml') !== '',
  specification: matrix.specification,
  format: 'GITB TDL test suite archive (ITB REST /testsuite/deploy or the ITB UI)',
  targetItb: itb,
  compiler: { otbGherkin: dependency('@opentestbed/otb-gherkin'), dialectFhirValidator: dependency('@opentestbed/dialect-fhir-validator') },
  endpointParameter: 'baseUrl (conformance statement parameter on each server actor; the suites run unaltered)',
  requirementsWithoutTest: Object.entries(matrix.requirements).filter(([, r]) => !r.scenarios.length).map(([id]) => id),
  notAnApprovedSpecification: true,
  suites,
}, null, 2) + '\n');
console.log(`Release ${version} (ITB ${itb}): ${suites.length} suites in ${path.relative(repo, out)}`);
for (const line of sums) console.log(`  ${line}`);
