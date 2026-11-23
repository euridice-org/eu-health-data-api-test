import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeature, requirementsFor, buildMatrix, describeScenario, failureMessage, errorCode, loadRequirements } from './lib/traceability.mjs';

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
  assert.equal(Object.keys(matrix.scenarios).length, 70);
  for (const [id, scenario] of Object.entries(matrix.scenarios)) assert.ok(scenario.covers.length, `${id} has no @covers`);
  const untested = Object.entries(matrix.requirements).filter(([, r]) => !r.scenarios.length).map(([id]) => id);
  assert.deepEqual(untested.sort(), ['api-consumer-backendAuthPresentToken', 'api-consumer-data', 'api-consumer-general',
    'api-provider-backendAuthDiscovery', 'api-provider-backendAuthProvideToken'].sort());
  assert.deepEqual(matrix.requirements['api-producer-data'].scenarios, ['cnt-001', 'cnt-002', 'cnt-003']);
});

test('the line shown on a test case names requirement, basis and source', () => {
  const entry = { code: 'EUAPI-DAP-008', requirements: ['api-provider-doc'], covers: ['DocumentReference.read'], side: 'server' };
  const text = describeScenario(entry, table);
  assert.match(text, /Error code: EUAPI-DAP-008\./);
  assert.match(text, /api-provider-doc \(EHDS Annex II §2\.1\)/);
  assert.match(text, /Covers: DocumentReference\.read\./);
  assert.match(text, /regulatoryAnchors\.html/);
});

test('error codes derive from the scenario id, are unique and are never reused for another scenario', () => {
  const matrix = buildMatrix();
  const codes = Object.values(matrix.scenarios).map(s => s.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(errorCode('dap-003'), 'EUAPI-DAP-003');
  for (const [id, scenario] of Object.entries(matrix.scenarios)) assert.equal(scenario.code, `EUAPI-${id.toUpperCase()}`);
});

test('a failure message names the code, the requirement and its basis, and what to do', () => {
  const matrix = buildMatrix();
  const message = failureMessage('dap-003', matrix.scenarios['dap-003'], table);
  assert.match(message, /^EUAPI-DAP-003: requirement not met\./);
  assert.match(message, /api-provider-backendAuthRequireToken \(EHDS Annex II §1\.4, Art\. 36\(3\)\(e\)\): The EHR system Interoperability Software Component SHALL require a valid authorization token/);
  assert.match(message, /Remediation: .*401 or 403.*See https:\/\/build\.fhir\.org\/ig\/euridice-org\/eu-health-data-api\/en\/authorization\.html#incorporate-access-token/);
  // The optional Document Submission Option has no D5.1 requirement and says so, with its own remediation.
  const optional = failureMessage('dap-015', matrix.scenarios['dap-015'], table);
  assert.match(optional, /none of the D5.1 requirements.*Document Submission Option, which is optional/);
  for (const [id, scenario] of Object.entries(matrix.scenarios)) {
    const text = failureMessage(id, scenario, table);
    assert.ok(text.length < 1500, `${id} message is ${text.length} characters`);
    assert.ok(!/["$]/.test(text));
  }
});
