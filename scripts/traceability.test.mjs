import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeature, requirementsFor, buildMatrix, describeScenario, loadRequirements } from './lib/traceability.mjs';

const table = loadRequirements();
const feature = side => `@actor:X
Feature: f
  Background:
    Given X is the system under test${side === 'server' ? ' at "http://ehr.example.org/fhir"' : ''} as defined by "u"
  Rule: r
    @covers:Patient.search.identifier,Patient.read
    # a comment between the tag and the scenario
    Scenario: tc-001 Looks the patient up
      When x
`;

test('the side of the system under test decides which requirement a path implements', () => {
  const server = parseFeature(feature('server'));
  const client = parseFeature(feature('client'));
  assert.equal(server.side, 'server');
  assert.equal(client.side, 'client');
  assert.deepEqual(server.scenarios[0].covers, ['Patient.search.identifier', 'Patient.read']);
  assert.deepEqual(requirementsFor(server.scenarios[0], 'server', table), ['api-provider-patient']);
  assert.deepEqual(requirementsFor(client.scenarios[0], 'client', table), ['api-consumer-patient']);
});

test('an unmapped path, a missing side and an unknown requirement all fail loudly', () => {
  assert.throws(() => requirementsFor({ id: 'x', covers: ['Nothing.here'] }, 'server', table), /no entry/);
  assert.throws(() => requirementsFor({ id: 'x', covers: ['security.smart-backend-services'] }, 'server', table), /no server mapping/);
  const broken = structuredClone(table);
  broken.covers['Patient.read'].server = ['api-does-not-exist'];
  assert.throws(() => requirementsFor({ id: 'x', covers: ['Patient.read'] }, 'server', broken), /unknown requirement/);
});

test('every shipped scenario is traced, and the known gaps are reported rather than hidden', () => {
  const matrix = buildMatrix();
  assert.equal(Object.keys(matrix.scenarios).length, 67);
  for (const [id, scenario] of Object.entries(matrix.scenarios)) assert.ok(scenario.covers.length, `${id} has no @covers`);
  const untested = Object.entries(matrix.requirements).filter(([, r]) => !r.scenarios.length).map(([id]) => id);
  assert.deepEqual(untested.sort(), ['api-consumer-backendAuthPresentToken', 'api-consumer-data', 'api-consumer-general',
    'api-producer-data', 'api-provider-backendAuthDiscovery', 'api-provider-backendAuthProvideToken'].sort());
});

test('the line shown on a test case names requirement, basis and source', () => {
  const entry = { requirements: ['api-provider-doc'], covers: ['DocumentReference.read'] };
  const text = describeScenario(entry, table);
  assert.match(text, /api-provider-doc \(EHDS Annex II §2\.1\)/);
  assert.match(text, /Covers: DocumentReference\.read\./);
  assert.match(text, /regulatoryAnchors\.html/);
});
