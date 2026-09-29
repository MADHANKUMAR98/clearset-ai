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
 *
 * On success the wrapper also writes public/coco-replay.json so the app can
 * replay the investigation step-by-step (CocoReplayPanel, VITE_COCO_CLI_REPLAY).
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const BACKEND = process.env.CLEARSET_BACKEND_URL || 'http://localhost:3001';
const MAX_TURNS = Number(process.env.COCO_MAX_TURNS || 48);
// cortex exec blocks all tools by default; the skill only needs to call the
// ClearSet backend over HTTP, which it does from the shell. Restricting the
// allow-list to Bash keeps CoCo from touching files or running raw SQL.
const ALLOWED_TOOLS = process.env.COCO_ALLOWED_TOOLS || 'Bash';
export const SKILL_NAME = 'investigate-settlement-exception';

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
export const REPLAY_PATH = join(REPO_ROOT, 'public', 'coco-replay.json');

export const PROVENANCE_LABELS = [
  'COCO CLI',
  'LIVE SNOWFLAKE',
  'CORTEX ANALYST',
  'CORTEX SEARCH',
  'COMPUTED',
  'LOCAL FALLBACK',
];

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

/** Removes ANSI colour codes and normalises line endings. */
export function stripAnsi(text) {
  const normalised = String(text ?? '').replace(/\r\n/g, '\n');
  // oxlint-disable-next-line no-control-regex -- ANSI escapes must be matched literally
  return normalised.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

/**
 * Parses a raw `cortex exec` transcript into the replay artefact consumed by
 * CocoReplayPanel. Pure function — unit tested, never runs the CLI.
 */
export function buildReplay(tradeId, rawOutput, meta = {}) {
  const text = stripAnsi(rawOutput);
  const transcript = text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0);

  const steps = [];
  const prelude = { n: 0, title: 'Session start', evidence: [] };
  let current = null;
  const labelPattern = new RegExp(`^\\[(${PROVENANCE_LABELS.join('|')})\\]\\s*(.*)$`, 'i');
  const stepPattern = /^\s*(?:#+\s*)?step\s*(\d{1,2})\s*[.):-]*\s*(.*)$/i;

  for (const line of transcript) {
    const stepMatch = line.match(stepPattern);
    if (stepMatch) {
      current = { n: Number(stepMatch[1]), title: (stepMatch[2] || '').trim(), evidence: [] };
      steps.push(current);
      continue;
    }
    const labelMatch = line.match(labelPattern);
    if (labelMatch) {
      const target = current ?? prelude;
      target.evidence.push({
        label: labelMatch[1].toUpperCase(),
        text: labelMatch[2].trim(),
      });
    }
  }
  if (prelude.evidence.length > 0) steps.unshift(prelude);

  const joined = transcript.join('\n');
  const riskMatch = joined.match(
    /(?:deterministic\s+score|risk\s+score)\D{0,12}(\d{1,3})\s*(?:\/\s*100)?/i,
  ) || joined.match(/\b(\d{1,3})\s*\/\s*100\b/);
  const rootCauseMatches = [...joined.matchAll(/root[\s-]*cause\s*[:-]?\s*(.{10,300})/gi)];
  const recMatches = [...joined.matchAll(/recommendations?\s*[:-]?\s*(.{10,300})/gi)];  const awaitingMatch = joined.match(/AWAITING\s+[A-Z' ]{4,40}/);

  return {
    skill: SKILL_NAME,
    tradeId,
    invocation: `npm run coco:investigate -- ${tradeId}`,
    status: awaitingMatch ? 'complete' : 'partial',
    startedAt: meta.startedAt ?? new Date().toISOString(),
    durationMs: Number(meta.durationMs ?? 0),
    steps,
    highlight: {
      riskScore: riskMatch ? Number(riskMatch[1]) : undefined,
      rootCause: rootCauseMatches.length
        ? rootCauseMatches[rootCauseMatches.length - 1][1].trim()
        : undefined,
      recommendation: recMatches.length ? recMatches[recMatches.length - 1][1].trim() : undefined,
      awaiting: awaitingMatch ? awaitingMatch[0].trim() : undefined,
    },
    transcript,
  };
}

/** Writes the replay artefact for the front-end (public/coco-replay.json). */
export async function saveReplay(replay, targetPath = REPLAY_PATH) {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(replay, null, 2)}\n`, 'utf8');
  return targetPath;
}

/**
 * Maps known failure modes to copy-pasteable remediation. Returns null when the
 * failure is not recognised.
 */
export function diagnoseFailure(output) {
  const text = stripAnsi(output);
  if (/Cortex Code is not enabled|usage limit has been reached|not available for trial accounts/i.test(text)) {
    return [
      '[wrapper] SNOWFLAKE ENTITLEMENT BLOCKED — Cortex Code (CoCo) is not enabled on this account.',
      '          Standard Snowflake trials ship with AI features disabled by default.',
      '          Fix (any one of):',
      '            1. Ask the Snowflake team to enable CoCo credits on this account.',
      '            2. Add a payment method in Snowsight > Billing (does NOT end the trial).',
      '            3. Use a dedicated CoCo CLI trial: https://signup.snowflake.com/cortex-code',
      '          Then re-run:  npm run coco:investigate -- <TRADE_ID>',
    ].join('\n');
  }
  if (/Programmatic access token is expired/i.test(text)) {
    return [
      '[wrapper] Snowflake credential expired for the active cortex connection.',
      '          Re-authenticate, then re-run:  cortex connections set clearset-hack',
    ].join('\n');
  }
  if (/backend is not reachable/i.test(text)) {
    return '[wrapper] Start the ClearSet backend first:  npm run server:start';
  }
  return null;
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

async function runCortex(prompt) {
  // Multi-line prompts cannot be passed safely through a Windows shell
  // command line — use the CLI's documented --file input mode instead.
  const promptFile = join(tmpdir(), `clearset-coco-prompt-${Date.now()}.txt`);
  await writeFile(promptFile, prompt, 'utf8');

  return new Promise((resolve) => {
    const child = spawn(
      'cortex',
      ['exec', '--file', promptFile, '--max-turns', String(MAX_TURNS), '--no-history', '--allowed', ALLOWED_TOOLS],
      { shell: true, stdio: ['inherit', 'pipe', 'pipe'] },
    );

    // Stream verbatim to the console while capturing for the replay artefact.
    let captured = '';
    const forward = (chunk) => {
      const text = chunk.toString();
      captured += text;
      process.stdout.write(text);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);

    child.on('exit', (code) => {
      unlink(promptFile).catch(() => {});
      resolve({ code: code ?? 1, output: captured });
    });
    child.on('error', (err) => {
      console.error('[wrapper] Failed to launch cortex CLI:', err.message);
      unlink(promptFile).catch(() => {});
      resolve({ code: 1, output: err.message });
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
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const { code, output } = await runCortex(buildPrompt(tradeId));

  if (code === 0) {
    try {
      const replay = buildReplay(tradeId, output, { startedAt, durationMs: Date.now() - t0 });
      const saved = await saveReplay(replay);
      console.log(`\n[wrapper] Replay saved: ${saved} (${replay.steps.length} steps, status=${replay.status})`);
    } catch (err) {
      console.warn(`[wrapper] Investigation succeeded but replay could not be saved: ${err.message}`);
    }
  } else {
    const hint = diagnoseFailure(output);
    if (hint) console.error(`\n${hint}`);
    console.error(`[wrapper] cortex exec exited with code ${code}.`);
  }
  process.exit(code);
}

// Only auto-run when invoked directly (tests import the pure helpers).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  main();
}
