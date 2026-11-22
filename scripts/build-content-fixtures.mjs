// Derive the content-validation fixtures from the official HL7 Europe content IGs.
// Needs the extracted IG packages (npm tarballs from https://packages.fhir.org/<id>/<version>),
// so it is a maintainer tool, not part of the build. The fixtures it writes are committed.
//
//   node scripts/build-content-fixtures.mjs <dir with the extracted packages>
//
// <dir> holds one folder per package: hl7.fhir.eu.eps-1.0.0-ballot/package/..., and so on.
//
// Valid documents are official examples that the validator accepts with no errors,
// either as published or after replacing example.org URLs (the validator rejects them
// in an instance). Invalid documents are made from a valid one by one documented change.
// The IGs are CC0-1.0. Run scripts/validate-content-fixtures.mjs afterwards: it proves each
// valid document passes and each invalid one fails.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'input/testing/content/fixtures/content-v1');
const packagesDir = process.argv[2];
if (!packagesDir) { console.error('Usage: build-content-fixtures.mjs <dir with extracted packages>'); process.exit(2); }

// The synthetic system that stands in for example.org, so the validator's example-URL check passes.
const SYNTHETIC = 'https://content-v1.eu-api-test.invalid';
const derivationText = c => c.derivation?.length ? `none (derived from the official example: ${c.derivation.join('; ')})` : 'none (the official example as published)';
const manifestNotCovered = 'the official examples are 290 KB and 1.2 MB, which the validator takes minutes to check, and the small minimal-metadata example needs a slicing error ignored whose validity is unestablished.';

export const categories = [
  { key: 'eps', scenario: 'cnt-001', category: 'Patient Summary', priorityCategory: 'Patient-Summaries',
    package: 'hl7.fhir.eu.eps', version: '1.0.0-ballot',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/bundle-eu-eps', wrongType: '11502-2',
    example: 'example/Bundle-EPSExampleBundle01NoProblemsMedicationAllergies.json' },
  { key: 'lab', scenario: 'cnt-002', category: 'Medical Test Results (Laboratory Report)', priorityCategory: 'Laboratory-Reports',
    package: 'hl7.fhir.eu.laboratory', version: '2.1.0',
    profile: 'http://hl7.eu/fhir/laboratory/StructureDefinition/Bundle-eu-lab', wrongType: '60591-5',
    example: 'examples/Bundle-SimpleChemistryResultReport.json' },
  { key: 'hdr', scenario: 'cnt-003', category: 'Hospital Discharge Report', priorityCategory: 'Discharge-Reports',
    package: 'hl7.fhir.eu.hdr', version: '1.0.0',
    profile: 'http://hl7.eu/fhir/hdr/StructureDefinition/bundle-eu-hdr', wrongType: '60591-5',
    example: 'examples/Bundle-HDR-Paolo-Marcheschi-Example.json', replaceExampleUrls: true },
];

// One change each; every invalid document differs from its valid one by exactly this.
export const mutations = [
  { id: 'bundle-type', change: 'Bundle.type is "collection" instead of "document"',
    expectedIssue: () => "is fixed to 'document'",
    apply: bundle => { bundle.type = 'collection'; } },
  { id: 'no-composition', change: 'the Composition entry (the first entry of a document) is removed',
    expectedIssue: () => 'bdl-11',
    apply: bundle => { bundle.entry.shift(); } },
  { id: 'status-missing', change: 'Composition.status (1..1) is removed',
    expectedIssue: () => 'Composition.status: minimum required = 1',
    apply: bundle => { delete bundle.entry[0].resource.status; } },
  { id: 'status-bad-code', change: 'Composition.status is "not-a-status", a code outside its required value set',
    expectedIssue: () => "was not found in the value set 'CompositionStatus'",
    apply: bundle => { bundle.entry[0].resource.status = 'not-a-status'; } },
  { id: 'wrong-document-type', change: 'Composition.type is the LOINC code of a different document type',
    // The Patient Summary and Discharge Report profiles pin the code; the Laboratory profile ties it to the report's code.
    expectedIssue: c => (c.key === 'lab' ? 'dr-comp-type' : 'pattern [system http://loinc.org'),
    apply: (bundle, c) => { bundle.entry[0].resource.type = { coding: [{ system: 'http://loinc.org', code: c.wrongType }] }; } },
  { id: 'subject-unresolved', change: 'Composition.subject points at an entry that is not in the Bundle',
    expectedIssue: () => "Can't find 'urn:uuid:00000000-0000-4000-8000-000000000000' in the bundle",
    apply: bundle => { bundle.entry[0].resource.subject = { reference: 'urn:uuid:00000000-0000-4000-8000-000000000000' }; } },
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};

fs.rmSync(output, { recursive: true, force: true });
const cases = [];
for (const c of categories) {
  const source = path.join(packagesDir, `${c.package}-${c.version}`, 'package', c.example);
  const bytes = fs.readFileSync(source);
  const upstreamLicense = JSON.parse(fs.readFileSync(path.join(packagesDir, `${c.package}-${c.version}`, 'package/package.json'), 'utf8')).license;
  if (upstreamLicense !== 'CC0-1.0') throw new Error(`${c.package} is ${upstreamLicense}, not CC0-1.0: do not copy its examples`);
  let text = bytes.toString('utf8');
  const derivation = [];
  if (c.replaceExampleUrls) { text = text.replaceAll('http://example.org', SYNTHETIC); derivation.push(`"http://example.org" replaced by "${SYNTHETIC}"`); }
  const valid = JSON.parse(text);
  if (valid.entry[0].resource.resourceType !== 'Composition') throw new Error(`${c.key}: first entry is not the Composition`);
  const validFile = `valid/${c.key}-valid.json`;
  write(path.join(output, validFile), valid);
  const base = { scenario: c.scenario, category: c.category, priorityCategory: c.priorityCategory, package: `${c.package}#${c.version}`, profile: c.profile };
  cases.push({ id: `${c.key}-valid`, ...base, expect: 'valid', file: validFile,
    derivedFrom: { file: `package/${c.example}`, sha256: sha256(bytes), license: upstreamLicense }, derivation });
  for (const m of mutations) {
    const invalid = structuredClone(valid);
    m.apply(invalid, c);
    const file = `invalid/${c.key}-${m.id}.json`;
    write(path.join(output, file), invalid);
    cases.push({ id: `${c.key}-${m.id}`, ...base, expect: 'invalid', file, changedFrom: `${c.key}-valid`, change: m.change, expectedIssue: m.expectedIssue(c) });
  }
}
write(path.join(output, 'manifest.json'), {
  fixtureSet: 'eu-api-content-v1', version: '1.0.0', fhirVersion: '4.0.1',
  purpose: 'Positive and negative synthetic documents for the EEHRxF content validation tests. No real people or clinical records.',
  notCovered: `Imaging reports: ${manifestNotCovered}`,
  cases,
});
const table = rows => rows.map(r => `| ${r.join(' | ')} |`).join('\n');
write(path.join(output, 'README.md'), `# EU API content fixtures v1

Synthetic FHIR R4 (4.0.1) documents for the content tests \`cnt-001\` to \`cnt-003\` (\`input/testing/content/eu-api-content-producer.feature\`). No real people or clinical records. Never paste a real person's health data into a test bed.

Each priority category has one **valid** document and six **invalid** ones. A valid document is an official example from the HL7 Europe content IG (CC0-1.0) that the validator accepts with no errors, as published (Patient Summary, Laboratory Report) or after replacing \`http://example.org\` by \`${SYNTHETIC}\` (Discharge Report), because the validator rejects example.org URLs in an instance. Each invalid document differs from its valid one by exactly one change, so a failing test points at that change.

## Use

Run the scenario named in the table in the test bed and paste a file when prompted: the valid one must pass, an invalid one must fail. They show what the test checks and let you confirm the test bed behaves as expected before you test your own system.

## Cases

| Case | Scenario | Category | Expect | Change from the valid document | The validator reports |
| --- | --- | --- | --- | --- | --- |
${table(cases.map(c => [`\`${c.file}\``, c.scenario, c.category, c.expect, c.change ?? derivationText(c), c.expectedIssue ? `"${c.expectedIssue}"` : '-']))}

## Verified, not assumed

\`scripts/validate-content-fixtures.mjs\` runs every case against the validator, without ignoring slicing errors, and checks that valid documents give no errors and that each invalid one gives an error containing the text above. Run it with the ITB validator (see the script header). Regenerate with \`scripts/build-content-fixtures.mjs\` (needs the extracted IG packages).

## Limits

- Imaging reports are not covered: ${manifestNotCovered}
- The validator checks codes against its terminology server (tx.fhir.org unless it is configured otherwise), so results for terminology bindings depend on that service.
- Validation messages come from the pinned validator build and may differ in another version.
- The Bundle profile is checked, not clinical meaning.
- This is a demonstration fixture set, not an approved test specification.
`);
console.log(`${cases.length} cases written to ${path.relative(root, output)}; now run scripts/validate-content-fixtures.mjs`);
