# EU API content fixtures v1

Synthetic FHIR R4 (4.0.1) documents for the content tests `cnt-001` to `cnt-003` (`input/testing/content/eu-api-content-producer.feature`). No real people or clinical records. Never paste a real person's health data into a test bed.

Each priority category has one **valid** document and six **invalid** ones. A valid document is an official example from the HL7 Europe content IG (CC0-1.0) that the validator accepts with no errors, as published (Patient Summary, Laboratory Report) or after replacing `http://example.org` by `https://content-v1.eu-api-test.invalid` (Discharge Report), because the validator rejects example.org URLs in an instance. Each invalid document differs from its valid one by exactly one change, so a failing test points at that change.

## Use

Run the scenario named in the table in the test bed and paste a file when prompted: the valid one must pass, an invalid one must fail. They show what the test checks and let you confirm the test bed behaves as expected before you test your own system.

## Cases

| Case | Scenario | Category | Expect | Change from the valid document | The validator reports |
| --- | --- | --- | --- | --- | --- |
| `valid/eps-valid.json` | cnt-001 | Patient Summary | valid | none (the official example as published) | - |
| `invalid/eps-bundle-type.json` | cnt-001 | Patient Summary | invalid | Bundle.type is "collection" instead of "document" | "is fixed to 'document'" |
| `invalid/eps-no-composition.json` | cnt-001 | Patient Summary | invalid | the Composition entry (the first entry of a document) is removed | "bdl-11" |
| `invalid/eps-status-missing.json` | cnt-001 | Patient Summary | invalid | Composition.status (1..1) is removed | "Composition.status: minimum required = 1" |
| `invalid/eps-status-bad-code.json` | cnt-001 | Patient Summary | invalid | Composition.status is "not-a-status", a code outside its required value set | "was not found in the value set 'CompositionStatus'" |
| `invalid/eps-wrong-document-type.json` | cnt-001 | Patient Summary | invalid | Composition.type is the LOINC code of a different document type | "pattern [system http://loinc.org" |
| `invalid/eps-subject-unresolved.json` | cnt-001 | Patient Summary | invalid | Composition.subject points at an entry that is not in the Bundle | "Can't find 'urn:uuid:00000000-0000-4000-8000-000000000000' in the bundle" |
| `valid/lab-valid.json` | cnt-002 | Medical Test Results (Laboratory Report) | valid | none (the official example as published) | - |
| `invalid/lab-bundle-type.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | Bundle.type is "collection" instead of "document" | "is fixed to 'document'" |
| `invalid/lab-no-composition.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | the Composition entry (the first entry of a document) is removed | "bdl-11" |
| `invalid/lab-status-missing.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | Composition.status (1..1) is removed | "Composition.status: minimum required = 1" |
| `invalid/lab-status-bad-code.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | Composition.status is "not-a-status", a code outside its required value set | "was not found in the value set 'CompositionStatus'" |
| `invalid/lab-wrong-document-type.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | Composition.type is the LOINC code of a different document type | "dr-comp-type" |
| `invalid/lab-subject-unresolved.json` | cnt-002 | Medical Test Results (Laboratory Report) | invalid | Composition.subject points at an entry that is not in the Bundle | "Can't find 'urn:uuid:00000000-0000-4000-8000-000000000000' in the bundle" |
| `valid/hdr-valid.json` | cnt-003 | Hospital Discharge Report | valid | none (derived from the official example: "http://example.org" replaced by "https://content-v1.eu-api-test.invalid") | - |
| `invalid/hdr-bundle-type.json` | cnt-003 | Hospital Discharge Report | invalid | Bundle.type is "collection" instead of "document" | "is fixed to 'document'" |
| `invalid/hdr-no-composition.json` | cnt-003 | Hospital Discharge Report | invalid | the Composition entry (the first entry of a document) is removed | "bdl-11" |
| `invalid/hdr-status-missing.json` | cnt-003 | Hospital Discharge Report | invalid | Composition.status (1..1) is removed | "Composition.status: minimum required = 1" |
| `invalid/hdr-status-bad-code.json` | cnt-003 | Hospital Discharge Report | invalid | Composition.status is "not-a-status", a code outside its required value set | "was not found in the value set 'CompositionStatus'" |
| `invalid/hdr-wrong-document-type.json` | cnt-003 | Hospital Discharge Report | invalid | Composition.type is the LOINC code of a different document type | "pattern [system http://loinc.org" |
| `invalid/hdr-subject-unresolved.json` | cnt-003 | Hospital Discharge Report | invalid | Composition.subject points at an entry that is not in the Bundle | "Can't find 'urn:uuid:00000000-0000-4000-8000-000000000000' in the bundle" |

## Verified, not assumed

`scripts/validate-content-fixtures.mjs` runs every case against the validator, without ignoring slicing errors, and checks that valid documents give no errors and that each invalid one gives an error containing the text above. Run it with the ITB validator (see the script header). Regenerate with `scripts/build-content-fixtures.mjs` (needs the extracted IG packages).

## Limits

- Imaging reports are not covered: the official examples are 290 KB and 1.2 MB, which the validator takes minutes to check, and the small minimal-metadata example needs a slicing error ignored whose validity is unestablished.
- The validator checks codes against its terminology server (tx.fhir.org unless it is configured otherwise), so results for terminology bindings depend on that service.
- Validation messages come from the pinned validator build and may differ in another version.
- The Bundle profile is checked, not clinical meaning.
- This is a demonstration fixture set, not an approved test specification.
