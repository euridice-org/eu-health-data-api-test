// Point a server actor's conformance statement at the implementation under test.
//
//   node --env-file=itb/.env itb/configure.mjs DocumentAccessProvider http://host.docker.internal:8082/fhir
//   node --env-file=itb/.env itb/configure.mjs DocumentAccessProvider --clear
//
// The suites read this as the statement parameter baseUrl and are never edited.
// The same parameter can be set in the ITB UI (the conformance statement's
// configuration) or by any other client of the ITB REST API (POST /configure).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const base = `http://localhost:${process.env.ITB_PORT || 9000}/api/rest`;
const state = JSON.parse(fs.readFileSync(path.join(root, '.state.json'), 'utf8'));
const [actorId, value] = process.argv.slice(2);
if (!actorId || !value) {
  console.error('Usage: configure.mjs <Actor> <base URL | --clear>   (Actor: DocumentAccessProvider, GroupedProvider or ResourceAccessProvider)');
  process.exit(2);
}
if (value !== '--clear' && !/^https?:\/\/[^\s]+$/.test(value)) {
  console.error(`Not an http(s) base URL: ${value}`);
  process.exit(2);
}
async function api(method, endpoint, body) {
  const res = await fetch(`${base}${endpoint}`, {
    method, headers: { ITB_API_KEY: state.community, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint}: HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const actors = await api('GET', `/specification/${state.specification}/actors`);
const actor = actors.find(a => a.identifier === actorId);
if (!actor) throw new Error(`Unknown actor ${actorId}; known: ${actors.map(a => a.identifier).join(', ')}`);
// Omitting the value removes it again.
const property = value === '--clear' ? { key: 'baseUrl' } : { key: 'baseUrl', value };
await api('POST', '/configure', { statementProperties: [{ system: state.system, actor: actor.apiKey, properties: [property] }] });
console.log(value === '--clear' ? `${actorId}: baseUrl cleared; the suites fall back to the URL in the feature file.`
  : `${actorId}: baseUrl = ${value}`);
