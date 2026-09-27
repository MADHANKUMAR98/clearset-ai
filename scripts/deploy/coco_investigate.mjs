#!/usr/bin/env node
/**
 * ClearSet AI — CoCo CLI investigation launcher.
 *
 * Drives the registered `investigate-settlement-exception` CoCo skill
 * (.snowflake/cortex/skills/investigate-settlement-exception/SKILL.md)
 * through `cortex exec` (Cortex Code non-interactive mode).
 *
 * Usage:
 *   node scripts/coco_investigate.mjs <TRADE_ID>
 *
 * Safety model:
 *   - Accepts ANY trade id matching ^[A-Za-z0-9][A-Za-z0-9-]{0,49}$ — nothing is hardcoded.
 *   - The skill is READ-ONLY: it may retrieve evidence and recommend, never approve,
 *     dispatch, or mutate. Final human approval happens in the ClearSet application.
 *   - Output is shown exactly as CoCo reports it (no synthetic streaming).
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const BACKEND = process.env.CLEARSET_BACKEND_URL || 'http://localhost:3001';
const MAX_TURNS = Number(process.env.COCO_MAX_TURNS || 48);
// cortex exec blocks all tools by default; the skill only needs to call the
// ClearSet backend over HTTP, which it does from the shell. Restricting the
// allow-list to Bash keeps CoCo from touching files or running raw SQL.
const ALLOWED_TOOLS = process.env.COCO_ALLOWED_TOOLS || 'Bash';

export function isValidTradeId(tradeId) {
  return typeof tradeId === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(tradeId);
}

export function buildPrompt(tradeId, backendUrl = BACKEND) {
  return [
    `Use the investigate-settlement-exception skill to investigate settlement exception ${tradeId}.`,
    ``,
    `Follow all 10 steps of the skill against the ClearSet backend at ${backendUrl}.`,
    `Every evidence line you print MUST begin with exactly one provenance label describing its true source:`,
    `[LIVE SNOWFLAKE] [CORTEX ANALYST] [CORTEX SEARCH] [COMPUTED] [LOCAL FALLBACK].`,
    `Begin your output with the line [COCO CLI] investigation started for ${tradeId}.`,
    `Do NOT hardcode values — retrieve everything at runtime for ${tradeId} only.`,
    `You are strictly READ-ONLY: do not create cases, send messages, or modify anything.`,
    `Your SINGLE final message must contain ALL of: the Step 8 deterministic risk factor table,`,
    `the Step 9 root-cause analysis, and the Step 10 recommendation block ending with`,
    `"AWAITING ANALYST AUTHORISATION". Do not stop after Step 7.`,
  ].join('\n');
}

async function preflight() {
  try {
    const res = await fetch(`${BACKEND}/api/health`);
    const body = await res.json();
    if (!body?.snowflake) {
      console.warn('[wrapper] WARNING: backend is up but Snowflake is not connected — results will be labeled [LOCAL FALLBACK].');
    }
    return true;
  } catch {
    console.error(`[wrapper] ClearSet backend is not reachable at ${BACKEND}.`);
    console.error('           Start it first:  npm run server:start   (or node server/dist/index.js)');
    return false;
  }
}

function runCortex(prompt) {
  return new Promise(async (resolve) => {
    // Multi-line prompts cannot be passed safely through a Windows shell
    // command line — use the CLI's documented --file input mode instead.
    const promptFile = join(tmpdir(), `clearset-coco-prompt-${Date.now()}.txt`);
    await writeFile(promptFile, prompt, 'utf8');
    const child = spawn(
      'cortex',
      ['exec', '--file', promptFile, '--max-turns', String(MAX_TURNS), '--no-history', '--allowed', ALLOWED_TOOLS],
      { shell: true, stdio: 'inherit' },
    );
    child.on('exit', (code) => {
      unlink(promptFile).catch(() => {});
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      console.error('[wrapper] Failed to launch cortex CLI:', err.message);
      unlink(promptFile).catch(() => {});
      resolve(1);
    });
  });
}

async function main() {
  const tradeId = process.argv[2];
  if (!isValidTradeId(tradeId)) {
    console.error('Usage: node scripts/coco_investigate.mjs <TRADE_ID>');
    console.error('       TRADE_ID must match ^[A-Za-z0-9][A-Za-z0-9-]{0,49}$');
    process.exit(2);
  }
  if (!(await preflight())) process.exit(3);

  console.log(`[wrapper] Launching CoCo CLI (cortex exec) for ${tradeId} — max ${MAX_TURNS} turns, no history saved.`);
  const code = await runCortex(buildPrompt(tradeId));
  process.exit(code);
}

// Only auto-run when invoked directly (tests import the pure helpers).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  main();
}
