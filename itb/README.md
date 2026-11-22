# Local European Interoperability Test Bed

This directory runs the European Commission's stock ITB 1.30.2 for this IG,
following the Compose and REST bootstrap approach in
[trifork/itb-dk-extensions](https://github.com/trifork/itb-dk-extensions).
It imports every `input/testing/gherkin/*.feature` and `input/testing/content/*.feature`
as its own suite: currently seven suites and 70 cases. The original features remain the
source of truth.

The core scripts, validator, UI adaptation and regression checks are independent
of the implementation under test. The bootstrap provenance above does not imply
a dependency on a particular FHIR server.

- [Fixture campaign proposal](fixture-campaign-proposal.md): general guidance for discussion about central ITB deployments; not implemented campaign functionality.
- [Published fixture contract](../input/testing/fixtures/provider-v1/README.md): shared data, ID bindings and expected results for provider tests.

Keep implementation-specific endpoints, provisioning instructions and workarounds
in their adapter directory. Shared scripts should import reusable fixture modules
directly, and general proposals should describe behavior without depending on an
adapter's runner or deployment.

## Start and sign in

Prerequisites: Docker with Compose, Node.js 22 or newer, npm, Python 3.9 or newer and OpenSSL.
The first start needs network access to npm, Docker Hub, GitHub and FHIR package
servers. Allow several minutes for the validator's first startup.

From the repository root:

```sh
./itb/start.sh
```

Open **http://localhost:9000** and sign in as **eu-api-test@itb**. The generated
password is the `password` property in `itb/.users.json`. The same file contains
`adminPassword` for `admin@itb`. Credentials and API keys are generated locally,
stored with owner-only permissions, and excluded from Git.

Choose the **Implementation under test** system in **EU API local testing**,
then its conformance statements:

| Actor | Cases |
| --- | ---: |
| DocumentAccessProvider | 17 |
| DocumentConsumer | 6 |
| DocumentPublisher | 6 |
| GroupedProvider | 13 |
| ResourceAccessProvider | 18 |
| ResourceConsumer | 7 |
| ContentProducer | 3 |

`GroupedProvider` is the SUT identifier used inside the grouped publisher/access
provider feature; its descriptive `@actor` tag is `DocumentPublisherAccessProvider`.

Startup compiles, imports and assigns the tests. It does **not** execute the
70 conformance cases or establish compliance. They are demonstration tests;
their clinical/specification coverage has not been validated by this integration.

## Inspect response bodies

Response-body dialogs include a **Pretty print JSON** button for valid JSON
objects and arrays. **Show raw** restores the exact original text; **Copy to
clipboard** copies the currently displayed version. Formatting changes only the
viewer, never stored reports, and preserves numeric precision and duplicate keys.
This also works on historical sessions after refreshing the browser.

The local `gitb-ui` image extends pinned ITB 1.30.2 using `ui/Dockerfile` and a
guarded asset patch. `./itb/start.sh` builds it automatically. To update only the UI:

```sh
docker compose --env-file itb/.env up -d --build --no-deps gitb-ui
node --test itb/ui/json-viewer.test.mjs
```

Hard-refresh the ITB page after rebuilding. The patch is specific to the pinned
bundle and fails the build if its component hook changes; review it when upgrading
ITB. Editable documents, annotated reports, invalid JSON and other formats retain
their normal viewer.

## Configure an implementation

The suites are never edited to point at an implementation. Each server actor
(DocumentAccessProvider, GroupedProvider, ResourceAccessProvider) declares a
`baseUrl` parameter on its conformance statement, and every test case reads it.
Set it in the ITB UI (the statement's configuration), through the ITB REST API
(`POST /configure`, `statementProperties`), or with the helper:

```sh
node --env-file=itb/.env itb/configure.mjs DocumentAccessProvider http://host.docker.internal:8082/fhir
node --env-file=itb/.env itb/configure.mjs DocumentAccessProvider --clear
```

A trailing slash is ignored. Until it is set, the suites fall back to the
placeholder `http://ehr.example.org/fhir` from the feature file, which cannot
succeed, and ITB logs that `baseUrl` is not in the session context. For a server
on the Docker host use `http://host.docker.internal:<port>/<path>` so the engine
can reach it. Clients (consumers and the publisher) have no endpoint to set: the
test bed calls them back.

Provider cases prompt only for the tokens and reference identifiers used by that
scenario. CapabilityStatement checks (`dap-001`, `dap-002`, `dap-014`, `grp-001`,
`grp-002`, `rap-001`) need no operator input. Keep input prompts inside their
scenarios: prompts in `Background` run before every case, including metadata checks.
Consumer and publisher cases instruct the operator and
wait for the implementation to call ITB. Configure that implementation with the
HTTP callback address shown in the session log, of the form:

```text
http://localhost:8080/itbsrv/api/http/<system-api-key>/<FHIR-or-token-path>
```

Use the same system's key from the local `.state.json` (`system`). Run these
interactive cases one at a time for a given system. ITB routes callbacks by
system key. The loopback bindings are intended for local development; a remote
implementation requires a reachable callback address and deployment configuration.

The FHIR validator runs at `http://fhir-validator:8080` inside Compose and uses
FHIR R4, as required by the specification under test. The IG itself packages
TestPlans using R6. Features that require it load
`hl7.fhir.eu.health-data-api#1.0.0-ballot` through the validator's IG manager.

## Everyday commands

```sh
# Recompile all features without Docker or network (after npm ci).
npm run --prefix itb compile

# Import the compiled suites again, retaining test history and assignments.
node --env-file=itb/.env itb/setup.mjs

# Check the test user's login and all actor/case counts through the UI API.
node --env-file=itb/.env itb/users.mjs

# Real engine check: callback, FHIRPath, response and negative assertion.
# Deploys and removes a temporary suite; never executes an IG conformance case.
node --env-file=itb/.env itb/smoke.mjs

# Inspect or stop this project's containers; persistent volumes remain.
docker compose --env-file itb/.env ps
docker compose --env-file itb/.env logs --tail 100 gitb-srv
docker compose --env-file itb/.env stop
```

Rerunning startup reuses the domain, community, specification, organisation,
system and login. Do not delete `.env`, `.state.json` or `.users.json` while
retaining the database: they belong together. Do not use `down --volumes` unless
you intend to erase this installation's data and test history.

Optional ports: add `ITB_PORT=9001` and/or `ITB_CALLBACK_PORT=8081` to `itb/.env`
before startup if the defaults are occupied. Compose uses a dedicated project
name and volumes and does not claim fixed container names.

## Content validation

`ContentProducer` (`cnt-001` to `cnt-003`, from `input/testing/content/`) checks that a
document your system produced conforms to the HL7 Europe content IG's Bundle profile for
Patient Summary, Laboratory Report or Hospital Discharge Report. Run a case from the UI and
paste the document, as FHIR JSON, when prompted: the validator loads the content IG and
checks it with slicing errors counted. Use synthetic data only.

[The fixtures](../input/testing/content/fixtures/content-v1/README.md) hold a valid document
and six invalid ones per category, each invalid one a single documented change. Paste them
to see what the test checks. The valid and invalid files are proved against the validator,
not assumed, with the ITB validator running:

```sh
docker run --rm --network eu-health-data-api-itb_default \
  --mount type=bind,source="$PWD",target=/work -w /work node:22-alpine \
  node scripts/validate-content-fixtures.mjs
```

Things to know:

- **The prompt cannot be pre-answered over the REST API.** A session started through
  `POST /tests/start` fails at the paste prompt even with an `inputMapping` entry named after
  it ("Required request elements were found that were not provided with corresponding
  inputs", ITB 1.30.2). Run these cases from the UI. This was tested on the content cases
  only; the other cases that prompt for a value compile to the same kind of step. Reading
  values from a configuration property, as `baseUrl` does, works.
- **A document is pasted, not uploaded.** The dialect's upload step yields a binary value
  and has no decoding step, so it cannot feed the validator.
- **Large documents are slow.** The validator had not finished a 142 KB Patient Summary
  example after twelve minutes at full CPU, and it keeps working after the caller gives up
  (restart it to stop). Documents of 7 to 60 KB took 3 to 12 seconds, and the fixtures are
  7 to 27 KB. Imaging reports are not covered for that reason.
- **Terminology.** The validator checks codes against its terminology server (tx.fhir.org by
  default), so the codes in a pasted document leave your machine. That is why only synthetic
  data may be used.

## Requirements on each test case

Every compiled test case's description ends with the requirement it implements,
for example `Requirements: api-provider-doc (EHDS Annex II §2.1). Covers:
DocumentReference.search-type.`, with a link to the specification's regulatory
anchors. The requirement IDs are the Xt-EHR D5.1 IDs, mapped from each scenario's
`@covers` tags in [requirements.json](../input/testing/traceability/requirements.json).
That mapping is a draft for the specification owners to confirm.
`node scripts/build-traceability.mjs` writes the matrix beside it and lists the
requirements that have no test yet; `--check` fails when the matrix is stale or a
`@covers` path is unmapped, and `compile` fails on an unmapped path.

## Release archives

```sh
npm run --prefix itb compile && npm run --prefix itb release
npm run --prefix itb test      # checks on the compiled suites, no Docker
```

`itb/build/release/` then holds one suite ZIP per feature, `SHA256SUMS`,
`release.json` (version, commit, target ITB version, compiler versions, suites,
requirements without a test) and the traceability matrix. The archives are
byte-for-byte reproducible. They are normalised to stock ITB 1.30.2 (see below);
deploy them to any ITB through the UI or `POST /testsuite/deploy`. Whether another
ITB installation runs this version has to be checked with its operator. The
`.github/workflows/itb-suites.yml` workflow builds and attaches them to a release.

## Build and compatibility details

The npm lockfile pins `@opentestbed/otb-gherkin` 0.5.0 and the FHIR validator
dialect 2.0.0. Each feature is compiled independently because that compiler's
multi-file ZIP output contains only the final suite. Archives, TDL and import
diagnostics are generated under `itb/build/`; `manifest.json` records all cases.

`normalize.py` adapts generated TDL to stock ITB 1.30.2. It preserves assertions
while translating incoming HTTP references to `request`, `path` to `uri`,
timeouts to milliseconds, and substring checks to `ExpressionValidator`. Outgoing
URIs use `iri-to-uri` to encode characters such as token-search pipes, and response
header lookups use the lowercase names returned by the HTTP handler.
Validator calls originate from the simulated test-harness actor, and the user
lane is named **Test operator**. Compact evaluation/check labels keep FHIRPath
expressions from dominating the diagram; the full expressions remain in step
request reports. HTTP responses remain part of the corresponding send report.
HTTP replies become `receive/result` steps and outputs, preserving the checks
before the response. It fails on unsupported transformations. This follows the
[ITB 1.30.2 receive-result contract](https://github.com/ISAITB/gitb/blob/1.30.2/gitb-testbed-service/src/test/resources/tdl/msg/msg-http-receive-result-steps.xml).
No generated TDL is committed, and source Gherkin is not rewritten by the build.

The stock ITB images and Java base image are pinned by digest. The validator is
built from the same upstream JAR used by
[OpenTestBed's FHIR plugin](https://github.com/OpenTestBed/itb-plugin-fhir-validator/blob/main/Dockerfile),
with its SHA-256 checked during the build. That upstream `wip` download is
mutable: a replacement fails the checksum until the pin is deliberately updated.
The validator's package cache and the ITB database/repository use named volumes.

| File | Purpose |
| --- | --- |
| `../docker-compose.yml` | Isolated ITB core, FHIR validator and persistent volumes |
| `start.sh` | Install, compile, start, import and provision the test user |
| `compile.mjs`, `normalize.py` | Build a deployable ZIP per feature |
| `setup.mjs` | REST bootstrap, suite import and actor assignment |
| `users.mjs` | Local login provisioning and UI access verification |
| `configure.mjs` | Set or clear a server actor's `baseUrl` without editing a suite |
| `release.mjs` | Versioned, checksummed suite archives for a test bed that deploys them |
| `../scripts/validate-content-fixtures.mjs` | Proves the content fixtures pass or fail as their manifest says |
| `test-compiled-suites.mjs` | Checks on the compiled suites: parameter, requirement lines, reproducibility |
| `smoke.mjs`, `tests/smoke.feature` | Positive and negative engine integration checks |
| `test-search-assertions.mjs` | Server-independent FHIRPath regression checks using shared fixtures |
| `validator/Dockerfile` | Checksum-pinned FHIR validator REST service |
| `fixture-campaign-proposal.md` | General central-deployment proposal for discussion |
| `.env`, `.state.json`, `.users.json` | Ignored local configuration and credentials |

## Shared fixture and assertion checks

These checks exercise the published data and test assertions independently of
which FHIR server is used as the implementation under test. Starting ITB does
not provision data in that implementation. Load or enter the applicable fixtures
and supply the actual server-assigned IDs to the test inputs as described in the
[fixture contract](../input/testing/fixtures/provider-v1/README.md).

The ten clinical search cases require matching entries of the
expected resource type, a patient reference on every match, and the requested
patient ID on all matches. Explicit `_include` entries are excluded from these
checks; missing search metadata is treated as a match. Target and control
fixtures use the same filters so a server ignoring the patient filter is caught.

Only `dap-012`, `grp-012`, `rap-004`, `pub-003` and `pub-004` load the EU API IG
into the validator: they validate against its dependency profiles. Core Bundle
validation and FHIRPath checks do not require that package load. Loading the IG
configures the validator; loading the fixture transaction populates the SUT.

Check fixture consistency and run isolated structural/profile validation:

```sh
node scripts/build-fixtures.mjs --check
node --test scripts/fixture-data.test.mjs
node scripts/validate-fixtures.mjs
```

The last command uses the pinned validator image and existing cache in an isolated
JVM with external terminology disabled (`-tx n/a`). It validates all resources
and both EU Core Patient profiles without ignoring slicing errors. Reports are
under `itb/build/fixture-validation/`; it is not evidence of complete terminology
validation.

Run the 140 positive/negative FHIRPath regression checks from the repository root:

```sh
docker run --rm --network eu-health-data-api-itb_default \
  --mount type=bind,source="$PWD",target=/work,readonly -w /work \
  node:22-alpine node itb/test-search-assertions.mjs
```

These evaluate the actual source-feature assertions against the running validator,
including empty results, wrong types, wrong/mixed patients, missing references,
explicit includes, and relative/absolute/versioned references. Historical ITB
sessions retain their original diagrams; open a newly executed session to see
the corrected mapping and assertions.
