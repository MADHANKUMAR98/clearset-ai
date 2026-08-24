/**
 * Unit tests — CoCo CLI investigation launcher (scripts/coco_investigate.mjs).
 * Pure-logic tests only: never spawns the cortex CLI, never touches the network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTradeId, buildPrompt } from '../../scripts/coco_investigate.mjs';

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

test('buildPrompt honours a custom backend URL', () => {
  const prompt = buildPrompt('TRD-1', 'http://localhost:9999');
  assert.match(prompt, /http:\/\/localhost:9999/);
});
