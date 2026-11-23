// Requirement traceability for the Gherkin features. No server access.
//
// Each scenario names the specification paths it tests in @covers. The mapping
// in input/testing/traceability/requirements.json turns those paths into the
// D5.1 requirement IDs (and EHDS basis) that the paths implement. The mapping
// depends on which side of the exchange the system under test is on, because
// the same path (Patient.search.identifier) implements a provider requirement
// when a server is tested and a consumer requirement when a client is tested.
// A feature that tests neither says so with a @side tag (@side:producer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const featuresDir = path.join(root, 'input/testing/gherkin');
export const contentDir = path.join(root, 'input/testing/content');
export const traceabilityDir = path.join(root, 'input/testing/traceability');

export function loadRequirements(file = path.join(traceabilityDir, 'requirements.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Scenarios of one feature: id, title, @covers paths, and the side of the system under test. */
export function parseFeature(text, filename = 'feature') {
  const sut = text.match(/Given\s+(\w+) is the system under test( at "[^"]*")?/);
  if (!sut) throw new Error(`${filename}: no system under test`);
  // A tested server is addressed by URL, a tested client is not; @side overrides both.
  const side = text.match(/^@.*@side:(\w+)/m)?.[1] ?? (sut[2] ? 'server' : 'client');
  const scenarios = [];
  let covers = null;
  for (const line of text.split('\n')) {
    const tag = line.match(/^\s*@covers:(\S+)/);
    if (tag) covers = tag[1].split(',');
    const scenario = line.match(/^\s*Scenario:\s+(\S+)\s*(.*)$/);
    if (scenario) {
      scenarios.push({ id: scenario[1], title: scenario[2].trim(), covers: covers ?? [] });
      covers = null;
    }
  }
  return { actor: sut[1], side, scenarios };
}

/** Requirement IDs a scenario implements; throws on a path the mapping does not know. */
export function requirementsFor(scenario, side, table) {
  const ids = [];
  for (const covered of scenario.covers) {
    const entry = table.covers[covered];
    if (!entry) throw new Error(`${scenario.id}: @covers path "${covered}" has no entry in requirements.json`);
    if (!Array.isArray(entry[side])) {
      throw new Error(`${scenario.id}: "${covered}" has no ${side} mapping in requirements.json (use [] if it implements none)`);
    }
    for (const id of entry[side]) {
      if (!table.requirements[id]) throw new Error(`requirements.json: "${covered}" names unknown requirement "${id}"`);
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Stable error code of a scenario: the prefix and its upper-cased id. */
export function errorCode(scenarioId, table = loadRequirements()) {
  return `${table.errorCodes.prefix}-${scenarioId.toUpperCase()}`;
}

/**
 * The message a tester reads when the test case fails (USB-060): the stable code, the
 * requirement that is not met with its basis, and what to do about it. The failing
 * assertion itself is in the step report. No double quote: it becomes a TDL string literal.
 */
export function failureMessage(scenarioId, entry, table = loadRequirements()) {
  const link = remediation => `${remediation.text} See ${table.remediationBase}${remediation.page}`;
  let requirement, remediation;
  if (entry.requirements.length) {
    requirement = entry.requirements.map(id => `${id} (${table.requirements[id].basis}): ${table.requirements[id].text}`).join(' | ');
    remediation = [...new Set(entry.requirements.map(id => link(table.requirements[id].remediation)))].join(' | ');
  } else {
    requirement = 'none of the D5.1 requirements (an optional capability of the specification).';
    remediation = entry.covers.map(c => table.covers[c].remediation?.[entry.side]).filter(Boolean).map(link).join(' | ')
      || 'See the specification for this optional capability.';
  }
  const message = `${errorCode(scenarioId, table)}: requirement not met. ${requirement} Remediation: ${remediation} The failing assertion is in the step report.`;
  if (/["$]/.test(message)) throw new Error(`${scenarioId}: the failure message contains a double quote or a dollar sign`);
  return message;
}

export function buildMatrix({ dirs = [featuresDir, contentDir], table = loadRequirements() } = {}) {
  const scenarios = {};
  const requirements = Object.fromEntries(Object.entries(table.requirements)
    .map(([id, requirement]) => [id, { ...requirement, scenarios: [] }]));
  const files = dirs.flatMap(dir => fs.readdirSync(dir).filter(f => f.endsWith('.feature')).sort().map(f => path.join(dir, f)));
  for (const file of files) {
    const filename = path.basename(file);
    const feature = parseFeature(fs.readFileSync(file, 'utf8'), filename);
    for (const scenario of feature.scenarios) {
      const ids = requirementsFor(scenario, feature.side, table);
      scenarios[scenario.id] = { code: errorCode(scenario.id, table), feature: filename, actor: feature.actor, side: feature.side,
        title: scenario.title, covers: scenario.covers, requirements: ids };
      for (const id of ids) requirements[id].scenarios.push(scenario.id);
    }
  }
  const unusedPaths = Object.keys(table.covers).filter(
    covered => !Object.values(scenarios).some(s => s.covers.includes(covered)));
  if (unusedPaths.length) throw new Error(`requirements.json maps paths no scenario covers: ${unusedPaths.join(', ')}`);
  return { specification: table.specification, source: table.source, status: table.status, errorCodes: table.errorCodes, requirements, scenarios };
}

/** The requirement line shown on a test case in the test bed (GEN-050, USB-050). */
export function describeScenario(entry, table) {
  const cited = entry.requirements.map(id => `${id} (${table.requirements[id].basis})`);
  return [cited.length ? `Requirements: ${cited.join('; ')}.` : 'Requirements: none of the D5.1 requirements (an optional capability of the specification).',
    entry.covers.length ? `Covers: ${entry.covers.join(', ')}.` : '',
    `Error code: ${entry.code}.`,
    `Source: ${table.source}`].filter(Boolean).join(' ');
}

export function renderMarkdown(matrix) {
  const lines = [
    '# Requirement traceability',
    '',
    `Specification: \`${matrix.specification}\`. Requirement source: ${matrix.source}`,
    '',
    `**Status: ${matrix.status}.** Generated by \`node scripts/build-traceability.mjs\` from the \`@covers\` tags of the Gherkin features and \`requirements.json\`. Do not edit.`,
    '',
    'A requirement is listed as having tests when a scenario is *tagged* with a path that implements it. A step that asserts something without a matching tag (for example the bearer token the consumers present) is not counted.',
    '',
    `Error codes: ${matrix.errorCodes.rule}`,
    '',
    '## By requirement',
    '',
    '| Requirement | EHDS basis | Scenarios |',
    '| --- | --- | --- |',
  ];
  for (const [id, requirement] of Object.entries(matrix.requirements)) {
    lines.push(`| \`${id}\` | ${requirement.basis} | ${requirement.scenarios.join(', ') || '**no test in this repository**'} |`);
  }
  lines.push('', '## By scenario', '', '| Scenario | Error code | Actor | Requirements | Covers |', '| --- | --- | --- | --- | --- |');
  for (const [id, scenario] of Object.entries(matrix.scenarios)) {
    lines.push(`| ${id} | \`${scenario.code}\` | ${scenario.actor} | ${scenario.requirements.map(r => `\`${r}\``).join(', ') || '-'} | ${scenario.covers.join(', ')} |`);
  }
  return lines.join('\n') + '\n';
}
