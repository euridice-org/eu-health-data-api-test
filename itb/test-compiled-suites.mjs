// Checks on the compiled suites. Needs `npm run --prefix itb compile` first; no Docker, no network.
//   node --test itb/test-compiled-suites.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { featuresDir, contentDir, parseFeature } from '../scripts/lib/traceability.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(root, 'build');
const manifest = JSON.parse(fs.readFileSync(path.join(build, 'manifest.json'), 'utf8'));
const read = file => fs.readFileSync(file, 'utf8');
const xmlFiles = dir => fs.readdirSync(dir).filter(f => f.endsWith('.xml')).map(f => path.join(dir, f));
const featureDirs = [featuresDir, contentDir];
const featureFile = name => featureDirs.map(dir => path.join(dir, name)).find(file => fs.existsSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('a server actor reads its endpoint from the conformance statement and declares the parameter', () => {
  for (const suite of manifest) {
    const feature = parseFeature(read(featureFile(suite.feature)), suite.feature);
    const dir = path.join(build, path.dirname(suite.archive));
    const files = xmlFiles(dir);
    const testSuite = files.map(read).find(text => text.startsWith("<?xml version='1.0' encoding='utf-8'?>\n<testsuite"));
    const cases = files.map(read).filter(text => text.includes('<testcase xmlns'));
    assert.equal(cases.length, suite.testCases.length, suite.feature);
    if (feature.side === 'server') {
      assert.match(testSuite, /<gitb:config name="baseUrl" kind="SIMPLE" use="O" \/>/, `${suite.feature} declares baseUrl`);
      for (const text of cases) {
        assert.match(text, new RegExp(`\\$${feature.actor}\\{baseUrl\\}`), `${suite.feature}: test case reads the parameter`);
        // The feature's URL survives only as the default for an unconfigured statement.
        assert.match(text, /then "http:\/\/ehr\.example\.org\/fhir" else replace\(/);
      }
    } else {
      assert.doesNotMatch(testSuite, /baseUrl/, `${suite.feature}: a client has no endpoint to configure`);
      for (const text of cases) assert.doesNotMatch(text, /\{baseUrl\}/);
    }
  }
});

test('every test case says which requirements it implements and what to do when it fails', () => {
  for (const suite of manifest) {
    for (const file of xmlFiles(path.join(build, path.dirname(suite.archive)))) {
      const text = read(file);
      if (!text.includes('<testcase xmlns')) continue;
      assert.match(text, /<gitb:description>[^<]*\nRequirements: [^<]*Error code: EUAPI-[A-Z]+-\d+\. Source: https:\/\/build\.fhir\.org\//, path.basename(file));
      // USB-060: a failed case says which code and requirement, and what to do (the default text is replaced).
      const scenario = path.basename(file).match(/^([a-z]+-\d+)-/)[1];
      assert.match(text, new RegExp(`<failure>\\s*<default>"EUAPI-${scenario.toUpperCase()}: requirement not met\\. [^"]*Remediation: [^"]*See https://[^"]*The failing assertion is in the step report\\."</default>`), `${scenario} failure message`);
      assert.doesNotMatch(text, /Test case failed\. Check step reports and logs/);
    }
  }
});

test('compiling twice gives byte-identical suite archives and leaves the source features untouched', () => {
  const features = () => featureDirs.flatMap(dir =>
    fs.readdirSync(dir).filter(f => f.endsWith('.feature')).sort().map(f => sha(path.join(dir, f))));
  const archives = () => manifest.map(suite => sha(path.join(build, suite.archive)));
  const [archivesBefore, featuresBefore] = [archives(), features()];
  execFileSync(process.execPath, [path.join(root, 'compile.mjs')], { cwd: root, stdio: 'ignore' });
  assert.deepEqual(archives(), archivesBefore);
  assert.deepEqual(features(), featuresBefore);
});
