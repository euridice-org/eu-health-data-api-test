# Alignment with the European digital testing environment (EU DTE)

How the tests in this repository relate to the Commission's draft implementing regulation on common
specifications for the European digital testing environment (Regulation (EU) 2025/327, Article 40(4)).
Written on 22 November 2026. **The draft is not adopted and this repository is not an approved test
specification.** Update this document when the draft changes.

## Sources

| Source | Status |
| --- | --- |
| Draft implementing regulation and its Annex, Ares(2026)10805685 of 19 November 2026, [initiative 17513](https://ec.europa.eu/info/law/better-regulation/have-your-say/initiatives/17513-European-Health-Data-Space-common-specifications-for-the-European-digital-testing-environment_en) | Draft. Feedback is open from 19 November to 17 December 2026 and adoption is planned for the first quarter of 2027. The references to the Article 15 and Article 36 implementing acts are still `[OP]` placeholders. |
| [EU DTE Release 1 Technical Specification](https://euagenda.eu/publications/european-digital-testing-environment-technical-specification-release-1), DG SANTE, July 2025 | Describes the architecture only: an ITB production installation, test suites in GITB TDL, and XML validation with MyHealth@EU Schematrons. It has no FHIR validator, no API tests and no logging tests. |
| [Regulatory anchors of the EU Health Data API](https://build.fhir.org/ig/euridice-org/eu-health-data-api/en/regulatoryAnchors.html) | Where the D5.1 requirement IDs and their EHDS basis come from. |

I read the whole Annex and the draft regulation's recitals and Articles 1 to 6. Only the first 10 of the draft PDF's 21 pages were
viewed; the rest appears to repeat the Annex, which I did not verify.

The draft sets requirements for the testing **environment**. This repository supplies **test content** for it (suites, test data,
mapping). Most of the draft's requirements therefore belong to whoever runs the environment; see
[Requirements that belong to the environment](#requirements-that-belong-to-the-environment).

Status: **Done**, **Partly**, **Not done**. "Verified" says how I checked it.

## Test content and test data

| Draft requirement | Status | What exists | Gap |
| --- | --- | --- | --- |
| Art. 4, GEN-030, TST-030: the same suites, unaltered, in an open machine-readable format | Done | The base URL of the system under test is the conformance-statement parameter `baseUrl` (`itb/configure.mjs`), so a feature is never edited. Suites ship as reproducible GITB TDL archives with checksums (`itb/release.mjs`). Verified: the capability cases of all three provider actors against stub servers that were compliant and deliberately broken, and 48 cases against a secured platform that implements the API (see [What running the tests showed](#what-running-the-tests-showed)). | The ITB version of the real DTE is unknown (Release 1 names no tag), so compatibility with the pinned 1.30.2 is unchecked. |
| GEN-050, GEN-060: test cases refer to the requirements they assess; traceability matrix | Partly | Every test case names its requirement, EHDS basis, covered paths and error code, and `input/testing/traceability/` holds the mapping and a generated matrix. Verified in the ITB UI. | The IDs are Xt-EHR D5.1 IDs, not those of the Article 15 and 36 acts, which are not published. The mapping is my draft and is not confirmed by the specification owners. |
| USB-060: actionable error messages, requirement identified, stable codes | Done for a failed test case | A failed case reports `EUAPI-<scenario id>` (for example `EUAPI-DAP-003`), the unmet requirement with its basis and normative text, and a remediation with a link. Verified through the REST API for failing cases on 7 stub variants and on that platform, and in the UI for `cnt-001`. | Remediation is written per requirement, not per assertion; the failing assertion is in the step report. A code is stable only while scenario ids are never renumbered or reused: the rule is in `requirements.json` and a test checks that codes follow ids, but nothing can detect a renumbering. |
| USB-050: scope, tested requirement, link to the specification, test steps, expected and observed outcomes | Partly | The requirement and link are on every test case (verified in the UI). ITB's step reports show the steps and results. | The link goes to the regulatory-anchors page, not to the rule. I did not check every step report for expected and observed values. |
| TST-070, TST-080: content validation per priority category, syntax and semantics | Partly | Document-level validation of a Patient Summary, a Laboratory Report and a Hospital Discharge Report against the HL7 Europe content IGs (`cnt-001` to `cnt-003`). Verified: 9 runs in the ITB UI, all as expected. | No tests for imaging reports (the official examples are 290 KB and 1.2 MB, too large for the validator), ePrescription and eDispensation, or resource-level content (EU Core). Nothing yet validates content a system *receives* (`api-consumer-data`). Terminology checks depend on tx.fhir.org. |
| TST-140: synthetic test data with positive and negative examples for each test case | Partly | `fixtures/content-v1`: 3 valid and 18 invalid documents, each invalid one a single documented change. Verified: `scripts/validate-content-fixtures.mjs` against the validator, and it fails on a broken expectation. | `provider-v1` has target and control data but almost no invalid data (`dap-016` is the exception). |
| TST-050: manual validation by uploading a file | Partly | A paste prompt is committed and was run in the UI. Upload was tested on a throwaway suite, in the UI and as a BASE64 binary over REST. | The committed content cases use paste, not upload. |
| TST-040, TST-060: content validation, data exchange validation, checklist validation | Partly | Content validation (a) and sending or receiving data (c) exist. `con-006` already uses an evidence-submission step for TLS. | No checklist (b) tests. |
| TST-010, USR-060: assign tests by EHR system class and priority category | Not done | None. | Needs the Article 36 act. Release 1's document-type list (Patient Summary, ePrescription, eDispensation, encounter report, medication overview, discharge report, laboratory result, imaging) is a candidate vocabulary for tags. |
| Recital 7, Article 25: the logging component | Not done | None. | The IG leaves D5.1's 6 logging requirements out of scope, so the requirements text has to come from D5.1 itself. |
| TST-100, MNT-010, MNT-020: versions, transition periods | Not done | `release.json` records the suite, specification and compiler versions. | No matrix of suite versions against specification versions; the suites pin `hl7.fhir.eu.health-data-api@1.0.0-ballot`. |
| GEN-040: no real health data | Partly | The fixtures are synthetic and the docs say so. | Nothing enforces it. A pasted document's codes go to the validator's terminology server (tx.fhir.org by default). |
| TST-110, TST-120, TST-130: isolated, parallel and asynchronous sessions | Partly | ITB sessions are independent, and 48 cases ran asynchronously through the REST API with a runner that answers the prompts. Verified. | A REST-started session fails at a prompt unless the interact step is skipped or the runner answers it. The skip was proven on a throwaway suite and is not compiled into the suites. Client-role cases route callbacks by system key and run one at a time per system. |
| SIT-030, SIT-070: a validation API; validators and simulators as separate modules | Partly | The FHIR validator is its own container and exposes the GITB validation API that the suites call. | It is not registered as an ITB validation service for users. |
| SIT-050, SIT-060: simulators for client and server | Partly | The test bed plays the Access Provider and token endpoint for client cases, and the suites act as client for server cases, for the six API actors. ITB identifies callers by system key. | No separate simulator modules, and nothing for the content producer. |
| Recital 8: national requirements kept separate | Done | The suites are harmonised-only. | None. |
| DOC-020: documentation lists supported specifications, test cases, APIs and known limitations | Partly | `README.md`, `itb/README.md` and the fixture READMEs. | Limitations are spread over several files. |

## Requirements that belong to the environment

These concern the deployed environment, not test content, so nothing here implements them: GEN-010, GEN-020; USR-010 to USR-080; SET-010 to SET-030;
TST-020, TST-090; REP-010 to REP-040, REP-050 (separate certificates for national extensions), REP-060 to REP-090; SIT-010, SIT-020, SIT-040, SIT-080; all of Annex II
(PRF, SEC, USB-010 to USB-040 and USB-070 to USB-100, RLB, AUD, SCL, MNT-030, DOC-010, DOC-030 to DOC-050).
ITB supplies some of them, such as the SUCCESS, FAILURE and UNDEFINED statuses and test reports. The local ITB in `itb/` is a
development setup, not a DTE: it uses a local login instead of EU Login, and I did not configure sealing of conformity certificates.

## D5.1 requirements and tests

`input/testing/traceability/matrix.md` is generated and lists every requirement against the scenarios that implement it. These have **no
test** today: `api-provider-backendAuthDiscovery`, `api-provider-backendAuthProvideToken`, `api-consumer-general`,
`api-consumer-backendAuthPresentToken` and `api-consumer-data`. `api-producer-data` has tests for three categories only.

## What running the tests showed

On 22 November 2026 all 48 provider cases ran against a FHIR platform that implements the API with security enabled, using real
OAuth 2.0 tokens from its token service (a system token and a patient token) and the published fixtures: **43 passed and 5 failed**.
The platform is deliberately not named: these results describe the tests, not a product. Each failure was traced to its assertion.

| Failed case | Cause |
| --- | --- |
| `dap-002`, `grp-002`, `rap-001` | The server's CapabilityStatement declares no SMART-on-FHIR security. |
| `dap-010`, `grp-010` | The server answers a request for `text/plain` with the FHIR Binary resource, so the content type is wrong. It serves the stored bytes only through a separate non-standard operation, labelled `application/octet-stream`. |

The run also found two defects in these tests, both fixed: `dap-017` sent an invalid DocumentReference, so a server that validates before
it authorizes refused it for the wrong reason, and `rap-001` asserted SMART security without being tagged for it, which sent a failing
tester to the wrong remediation. The 401-or-403 relaxation of `dap-003`, `grp-003` and `rap-002` was checked against stubs that answer 401, 403
and an open 200.

## Not verified

- The 19 client cases (consumer, publisher) have never been run against an implementation.
- The GitHub workflow `itb-suites.yml` has never run on GitHub.
- The content cases were run in the UI with 3 of the 6 invalid documents per category; the rest were checked against the validator only.
- The D5.1 mapping and the remediation texts have not been reviewed by anyone who owns the specification.
- No feedback has been submitted to the consultation.
