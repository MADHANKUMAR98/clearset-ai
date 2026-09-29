/**
 * Unit tests — CoCo CLI investigation launcher (scripts/coco_investigate.mjs).
 * Pure-logic tests only: never spawns the cortex CLI, never touches the network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isValidTradeId,
  buildPrompt,
  stripAnsi,
  isDecorative,
  buildReplay,
  saveReplay,
  diagnoseFailure,
} from '../../scripts/coco_investigate.mjs';

test('isValidTradeId accepts arbitrary well-formed trade ids', () => {
  assert.equal(isValidTradeId('TRD-92831'), true);
  assert.equal(isValidTradeId('X-1'), true);
  assert.equal(isValidTradeId('A'.repeat(50)), true);
});

test('isValidTradeId rejects injection and malformed input', () => {
  assert.equal(isValidTradeId(''), false);
  assert.equal(isValidTradeId(undefined), false);
  assert.equal(isValidTradeId('../etc/passwd'), false);
  assert.equal(isValidTradeId('bad id!'), false);
  assert.equal(isValidTradeId('a'.repeat(51)), false);
  assert.equal(isValidTradeId('-leading-dash'), false);
  assert.equal(isValidTradeId('semi;colon'), false);
  assert.equal(isValidTradeId('quote"delim'), false);
});

test('buildPrompt embeds the requested trade id verbatim', () => {
  const prompt = buildPrompt('TRD-424242');
  assert.match(prompt, /investigate settlement exception TRD-424242/);
  assert.match(prompt, /\[COCO CLI\] investigation started for TRD-424242/);
  assert.match(prompt, /for TRD-424242 only/);
});

test('buildPrompt carries provenance labels and read-only contract', () => {
  const prompt = buildPrompt('TRD-92831');
  for (const label of ['[LIVE SNOWFLAKE]', '[CORTEX ANALYST]', '[CORTEX SEARCH]', '[COMPUTED]', '[LOCAL FALLBACK]']) {
    assert.ok(prompt.includes(label), `missing label ${label}`);
  }
  assert.match(prompt, /READ-ONLY/);
  assert.match(prompt, /AWAITING ANALYST AUTHORISATION/);
  // Completion contract: agent must deliver steps 8-10 in its final message.
  assert.match(prompt, /Step 8 deterministic risk factor table/);
});

test('buildPrompt demands a STEP header for every one of the 10 sections', () => {
  const prompt = buildPrompt('TRD-92831');
  assert.match(prompt, /complete report containing ALL 10 sections/);
  assert.match(prompt, /STEP <n> - <TITLE>/);
  assert.match(prompt, /STEP 1 through STEP 10/);
  assert.match(prompt, /no section may be merged or omitted/);
});

test('buildPrompt honours a custom backend URL', () => {
  const prompt = buildPrompt('TRD-1', 'http://localhost:9999');
  assert.match(prompt, /http:\/\/localhost:9999/);
});

const SAMPLE_RUN = [
  '[COCO CLI] investigation started for TRD-92831',
  '## Step 1: Retrieve the exception',
  '[LIVE SNOWFLAKE] /api/exceptions returned EX-92831 severity CRITICAL',
  '### Step 8: Deterministic risk factor table',
  '[COMPUTED] Deterministic Score: 91/100 (CRITICAL)',
  'Step 9: Root cause analysis',
  '[COMPUTED] Root cause: SSI_NOT_FOUND for CP-192 at DTC participant 0244',
  'Step 10: Recommendation',
  '[COMPUTED] Recommendation: expedite SSI repair before the 15:30 cutoff',
  'AWAITING ANALYST AUTHORISATION',
].join('\n');

test('stripAnsi removes colour codes and normalises newlines', () => {
  assert.equal(stripAnsi('\u001b[31mRED\u001b[0m\r\nnext'), 'RED\nnext');
});

test('buildReplay extracts steps, provenance and highlights from a real transcript', () => {
  const replay = buildReplay('TRD-92831', SAMPLE_RUN, { durationMs: 1234 });

  assert.equal(replay.skill, 'investigate-settlement-exception');
  assert.equal(replay.tradeId, 'TRD-92831');
  assert.equal(replay.invocation, 'npm run coco:investigate -- TRD-92831');
  assert.equal(replay.status, 'complete');
  assert.equal(replay.durationMs, 1234);

  const stepNumbers = replay.steps.map((s) => s.n);
  assert.deepEqual(stepNumbers, [0, 1, 8, 9, 10]);

  const evidence = replay.steps.flatMap((s) => s.evidence);
  assert.ok(evidence.some((e) => e.label === 'COCO CLI'));
  assert.ok(evidence.some((e) => e.label === 'LIVE SNOWFLAKE'));
  assert.ok(evidence.some((e) => e.label === 'COMPUTED'));

  assert.equal(replay.highlight.riskScore, 91);
  assert.match(replay.highlight.rootCause, /SSI_NOT_FOUND for CP-192/);
  assert.match(replay.highlight.recommendation, /expedite SSI repair/);
  assert.equal(replay.highlight.awaiting, 'AWAITING ANALYST AUTHORISATION');
  assert.ok(replay.transcript.length >= 10);
});

test('buildReplay marks truncated runs as partial and strips ANSI first', () => {
  const truncated = '\u001b[31m[COCO CLI] investigation started for TRD-1\u001b[0m\nStep 2: collect';
  const replay = buildReplay('TRD-1', truncated);
  assert.equal(replay.status, 'partial');
  assert.equal(replay.highlight.riskScore, undefined);
  assert.ok(replay.transcript.every((line) => !line.includes('\u001b')));
});

// Shaped like a real `cortex exec` run: provenance labels behind list markers,
// decorative ruling after headers, and narrative lines that are NOT sections.
const RICH_RUN = [
  '[COCO CLI] investigation started for TRD-92831',
  'Loading skill. Steps 1-3 complete. Steps 4-5 in parallel. Steps 6-7 complete.',
  'STEP 1 — TRADE MASTER DATA',
  '1. [LIVE SNOWFLAKE] /api/trades returned TRD-92831 value $2,400,000',
  '## Step 2: Depository gateway status',
  '  - [CORTEX SEARCH] SOP-3.2 Expedited SSI Repair',
  'STEP 10 — RESOLUTION RECOMMENDATION━━━━━━━━━━━━━━',
  'Root Cause: Missing SSI for CP-192 at DTC 0244',
  'Applicable SOP: SOP-3.2 — Expedited SSI Repair',
  'Recommendation: ━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  'AWAITING ANALYST AUTHORISATION',
].join('\n');

test('buildReplay reads labels behind list markers and rejects decorative rules', () => {
  const replay = buildReplay('TRD-92831', RICH_RUN, { durationMs: 42 });

  assert.deepEqual(replay.steps.map((s) => s.n), [0, 1, 2, 10]);
  assert.equal(replay.steps[1].title, 'TRADE MASTER DATA');

  const labels = replay.steps.flatMap((s) => s.evidence).map((e) => e.label);
  assert.ok(labels.includes('LIVE SNOWFLAKE'), 'label behind a "1. " list marker');
  assert.ok(labels.includes('CORTEX SEARCH'), 'label behind a "- " list marker');

  assert.equal(replay.highlight.rootCause, 'Missing SSI for CP-192 at DTC 0244');
  assert.equal(replay.highlight.recommendation, 'SOP-3.2 — Expedited SSI Repair');
  assert.equal(replay.highlight.awaiting, 'AWAITING ANALYST AUTHORISATION');
  assert.equal(replay.status, 'complete');
});

test('isDecorative separates ruling from readable content', () => {
  assert.equal(isDecorative('━━━━━━━━━━━━'), true);
  assert.equal(isDecorative('─── ─── ───'), true);
  assert.equal(isDecorative('   '), true);
  assert.equal(isDecorative('expedite SSI repair before cutoff'), false);
  assert.equal(isDecorative('SOP-3.2 — Expedited SSI Repair'), false);
});

test('saveReplay writes a parseable artefact for the front-end', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'clearset-replay-'));
  const target = join(dir, 'nested', 'coco-replay.json');
  await saveReplay(buildReplay('TRD-92831', SAMPLE_RUN), target);
  const parsed = JSON.parse(await readFile(target, 'utf8'));
  assert.equal(parsed.tradeId, 'TRD-92831');
  assert.equal(parsed.status, 'complete');
  assert.ok(Array.isArray(parsed.steps) && parsed.steps.length > 0);
});

test('diagnoseFailure turns entitlement errors into actionable guidance', () => {
  const hint = diagnoseFailure('Error: Cortex Code is not enabled or the usage limit has been reached.');
  assert.ok(hint, 'expected guidance for the entitlement failure');
  assert.match(hint, /ENTITLEMENT BLOCKED/);
  assert.match(hint, /signup\.snowflake\.com\/cortex-code/);

  assert.match(diagnoseFailure('Programmatic access token is expired'), /cortex connections set/);
  assert.equal(diagnoseFailure('something unrelated happened'), null);
});
