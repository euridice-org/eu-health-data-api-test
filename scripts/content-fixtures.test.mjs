// Structural checks on the content fixtures. They need no validator and no network;
// scripts/validate-content-fixtures.mjs is what proves the documents behave as stated.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { contentDir, buildMatrix } from './lib/traceability.mjs';

const dir = path.join(contentDir, 'fixtures/content-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const load = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const feature = fs.readFileSync(path.join(contentDir, 'eu-api-content-producer.feature'), 'utf8');
const byId = Object.fromEntries(manifest.cases.map(c => [c.id, c]));

test('every priority category has one valid document and six invalid ones, all present on disk', () => {
  const categories = [...new Set(manifest.cases.map(c => c.category))];
  assert.equal(categories.length, 3);
  for (const category of categories) {
    const cases = manifest.cases.filter(c => c.category === category);
    assert.equal(cases.filter(c => c.expect === 'valid').length, 1, category);
    assert.equal(cases.filter(c => c.expect === 'invalid').length, 6, category);
  }
  for (const c of manifest.cases) assert.equal(load(c.file).resourceType, 'Bundle', c.file);
  const onDisk = ['valid', 'invalid'].flatMap(sub => fs.readdirSync(path.join(dir, sub)).map(f => `${sub}/${f}`)).sort();
  assert.deepEqual(onDisk, manifest.cases.map(c => c.file).sort(), 'no file without a manifest entry, or the reverse');
});

test('each invalid document differs from its valid one, and says why it must fail', () => {
  for (const c of manifest.cases.filter(c => c.expect === 'invalid')) {
    const valid = byId[c.changedFrom];
    assert.equal(valid?.expect, 'valid', `${c.id} is changed from a valid case`);
    assert.notDeepEqual(load(c.file), load(valid.file), `${c.id} must differ from ${valid.id}`);
    assert.ok(c.change && c.expectedIssue, `${c.id} states its change and the error the validator reports`);
    assert.equal(c.profile, valid.profile);
  }
});

test('valid documents record their CC0 source, and every case belongs to a scenario of the feature', () => {
  const matrix = buildMatrix();
  for (const c of manifest.cases) {
    assert.ok(matrix.scenarios[c.scenario], `${c.id}: scenario ${c.scenario} exists`);
    assert.ok(feature.includes(`"${c.profile}"`), `${c.id}: the feature validates against ${c.profile}`);
    assert.ok(feature.includes(`"${c.package}"`), `${c.id}: the feature loads ${c.package}`);
    if (c.expect === 'valid') {
      assert.match(c.derivedFrom.sha256, /^[0-9a-f]{64}$/);
      assert.equal(c.derivedFrom.license, 'CC0-1.0');
    }
  }
});

test('the fixtures contain no example.org URL, which the validator rejects in an instance', () => {
  for (const c of manifest.cases) assert.ok(!fs.readFileSync(path.join(dir, c.file), 'utf8').includes('example.org'), c.file);
});
