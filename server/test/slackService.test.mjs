/**
 * ClearSet AI — Slack integration unit tests.
 *
 * Run (after server build):
 *   node --test server/test/
 *
 * These tests exercise payload construction, feature-flag behavior, config
 * validation, transport failure handling, and log hygiene. No real Slack
 * endpoint is ever contacted.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSlackPayload,
  notifyCriticalException,
  sendSlackRaw,
  getSlackStatusSummary,
  isSlackEnabled,
  getSlackWebhookUrl,
} from '../dist/services/slackService.js';

const FAKE_WEBHOOK = 'https://hooks.slack.com/services/T000TEST/B000TEST/SECRET-XYZ-7890';

const SAMPLE_NOTIFICATION = {
  tradeId: 'TRD-92831',
  exceptionType: 'Missing Instruction',
  severity: 'CRITICAL',
  riskScore: 91,
  tradeValue: 2400000,
  currency: 'USD',
  counterpartyName: 'Apex Prime Clearing Ltd.',
  counterpartyId: 'CP-192',
  rootCause: 'Settlement instruction MT541 not received from counterparty before DTC cutoff.',
  recommendedResolution: 'Expedite SWIFT MT599 repair message and escalate to settlement desk lead.',
  applicableSop: 'SOP-OPS-032 §3.2 — Missing Instruction Repair Procedure',
  provenance: 'LIVE SNOWFLAKE',
  dataMode: 'snowflake',
};

function withEnv(env, fn) {
  const saved = {
    SLACK_ENABLED: process.env.SLACK_ENABLED,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  let result;
  try {
    result = fn();
  } catch (err) {
    restore();
    throw err;
  }
  // Async-aware: hold the environment until the awaited work completes.
  if (result && typeof result.then === 'function') {
    return result.finally(restore);
  }
  restore();
  return result;
}

function captureLogs(fn) {
  const errors = [];
  const warns = [];
  const logs = [];
  const origErr = console.error;
  const origWarn = console.warn;
  const origLog = console.log;
  console.error = (...a) => errors.push(a.map(String).join(' '));
  console.warn = (...a) => warns.push(a.map(String).join(' '));
  console.log = (...a) => logs.push(a.map(String).join(' '));
  try {
    return { result: fn(), errors, warns, logs };
  } finally {
    console.error = origErr;
    console.warn = origWarn;
    console.log = origLog;
  }
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------
describe('buildSlackPayload', () => {
  test('includes every required content element', () => {
    const payload = buildSlackPayload(SAMPLE_NOTIFICATION);

    assert.ok(payload.blocks && Array.isArray(payload.blocks) && payload.blocks.length > 0);
    const allText = JSON.stringify(payload);

    for (const expected of [
      'ClearSet AI',
      'TRD-92831',
      'Missing Instruction',
      'CRITICAL',
      '91/100',
      '2,400,000.00',
      'USD',
      'Apex Prime Clearing Ltd.',
      'CP-192',
      'MT541 not received',
      'MT599 repair message',
      'SOP-OPS-032',
      'LIVE SNOWFLAKE',
      'HUMAN APPROVAL REQUIRED',
      '[ APPROVE ]',
      '[ REJECT ]',
      '[ REQUEST MORE EVIDENCE ]',
    ]) {
      assert.ok(allText.includes(expected), `payload must include "${expected}"`);
    }

    // Fallback text exists for notifications list preview.
    assert.ok(payload.text.includes('TRD-92831'));
    assert.ok(payload.text.includes('Human approval required'));
  });

  test('marks approval actions as routing through ClearSet — no fake interactivity', () => {
    const payload = buildSlackPayload(SAMPLE_NOTIFICATION);
    const allText = JSON.stringify(payload);
    assert.ok(!allText.includes('"type":"actions"'), 'must not emit interactive action blocks');
    assert.ok(allText.includes('route through the ClearSet console'));
    assert.ok(allText.includes('No operational action has been taken'));
  });

  test('truncates oversized fields to stay within Slack limits', () => {
    const huge = 'x'.repeat(50_000);
    const payload = buildSlackPayload({
      ...SAMPLE_NOTIFICATION,
      rootCause: huge,
      recommendedResolution: huge,
    });
    for (const block of payload.blocks) {
      const serialized = JSON.stringify(block);
      assert.ok(serialized.length < 20_000, 'each block must stay well under Slack size caps');
    }
    const rootBlock = payload.blocks.find((b) => JSON.stringify(b).includes('Root Cause'));
    assert.ok(rootBlock.text.text.length < 3000);
  });

  test('omits SOP section cleanly when not provided', () => {
    const payload = buildSlackPayload({ ...SAMPLE_NOTIFICATION, applicableSop: undefined });
    const allText = JSON.stringify(payload);
    assert.ok(!allText.includes('Applicable SOP'));
    // Everything else still present
    assert.ok(allText.includes('TRD-92831'));
  });

  test('handles non-numeric trade value gracefully', () => {
    const payload = buildSlackPayload({ ...SAMPLE_NOTIFICATION, tradeValue: 'N/A' });
    assert.ok(JSON.stringify(payload).includes('N/A'));
  });
});

// ---------------------------------------------------------------------------
// Feature flag & configuration matrix
// ---------------------------------------------------------------------------
describe('feature flag and configuration', () => {
  beforeEach(() => {
    delete process.env.SLACK_ENABLED;
    delete process.env.SLACK_WEBHOOK_URL;
  });
  afterEach(() => {
    delete process.env.SLACK_ENABLED;
    delete process.env.SLACK_WEBHOOK_URL;
  });

  test('disabled mode reports DISABLED and skips delivery without any request', async () => {
    withEnv({ SLACK_ENABLED: 'false', SLACK_WEBHOOK_URL: FAKE_WEBHOOK }, () => {
      assert.equal(isSlackEnabled(), false);
      const status = getSlackStatusSummary();
      assert.equal(status.mode, 'DISABLED');
      assert.equal(status.enabled, false);
    });

    const captured = captureLogs(() => notifyCriticalException(SAMPLE_NOTIFICATION));
    const result = await captured.result;
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'SLACK_DISABLED');
    assert.equal(result.slack.mode, 'DISABLED');
    assert.equal(captured.errors.length + captured.warns.length, 0, 'disabled mode must be silent');
  });

  test('enabled but missing webhook URL is detected before any network attempt', async () => {
    await withEnv({ SLACK_ENABLED: 'true' }, async () => {
      assert.equal(getSlackWebhookUrl(), null);
      const status = getSlackStatusSummary();
      assert.equal(status.mode, 'NOT_CONFIGURED');
      assert.equal(status.configured, false);

      const captured = captureLogs(() => notifyCriticalException(SAMPLE_NOTIFICATION));
      const result = await captured.result;
      assert.equal(result.delivered, false);
      assert.equal(result.reason, 'SLACK_NOT_CONFIGURED');
    });
  });

  test('non-Slack or malformed webhook URLs are rejected as invalid configuration', () => {
    withEnv({ SLACK_ENABLED: 'true', SLACK_WEBHOOK_URL: 'https://evil.example.com/hook' }, () => {
      assert.equal(getSlackWebhookUrl(), null, 'non-Slack hosts must never be treated as configured');
    });
    withEnv({ SLACK_ENABLED: 'true', SLACK_WEBHOOK_URL: 'http://hooks.slack.com/services/T/B/S' }, () => {
      assert.equal(getSlackWebhookUrl(), null, 'insecure http:// must be rejected');
    });
    withEnv({ SLACK_ENABLED: 'true', SLACK_WEBHOOK_URL: 'not-a-url' }, () => {
      assert.equal(getSlackWebhookUrl(), null);
    });
  });

  test('status summary never leaks the webhook URL in any flag state', () => {
    withEnv({ SLACK_ENABLED: 'true', SLACK_WEBHOOK_URL: FAKE_WEBHOOK }, () => {
      const json = JSON.stringify(getSlackStatusSummary());
      assert.ok(!json.includes('SECRET-XYZ-7890'));
      assert.ok(!json.includes('hooks.slack.com'));
      assert.equal(getSlackStatusSummary().mode, 'ENABLED');
    });
  });

  test('flag accepts only the literal string "true"', () => {
    withEnv({ SLACK_ENABLED: 'TRUE' }, () => assert.equal(isSlackEnabled(), false));
    withEnv({ SLACK_ENABLED: '1' }, () => assert.equal(isSlackEnabled(), false));
    withEnv({ SLACK_ENABLED: 'true' }, () => assert.equal(isSlackEnabled(), true));
  });
});

// ---------------------------------------------------------------------------
// Transport failure handling
// ---------------------------------------------------------------------------
describe('delivery failure handling', () => {
  beforeEach(() => {
    delete process.env.SLACK_ENABLED;
    delete process.env.SLACK_WEBHOOK_URL;
  });

  test('unreachable endpoint resolves (never throws) with DELIVERY_ERROR', async () => {
    // Port 9 (discard) on localhost — nothing listens; connection fails fast.
    const unreachable = 'https://127.0.0.1:9/services/T000/B000/SECRET-XYZ-7890';
    const captured = captureLogs(() =>
      sendSlackRaw(buildSlackPayload(SAMPLE_NOTIFICATION), {
        webhookUrl: unreachable,
        timeoutMs: 1500,
        allowNonSlackHost: true, // TESTS ONLY — exercise transport failure locally
      }),
    );
    const result = await captured.result;

    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'DELIVERY_ERROR');

    const allLogged = [...captured.errors, ...captured.warns, ...captured.logs].join('\n');
    assert.ok(!allLogged.includes('SECRET-XYZ-7890'), 'webhook secret must never appear in logs');
    assert.ok(!allLogged.includes('https://'), 'no URL may appear in logged output');
  });

  test('notifyCriticalException swallows unexpected internal errors', async () => {
    await withEnv({ SLACK_ENABLED: 'true', SLACK_WEBHOOK_URL: FAKE_WEBHOOK }, async () => {
      // Malformed notification (null fields) must not throw out of the orchestrator.
      const result = await notifyCriticalException(null, 1000);
      assert.equal(result.delivered, false);
      assert.ok(['DELIVERY_ERROR'].includes(result.reason) || result.reason === undefined);
    });
  });

  test('timeout produces a clean failure rather than a hang', { timeout: 15_000 }, async () => {
    const started = Date.now();
    const captured = captureLogs(() =>
      sendSlackRaw(buildSlackPayload(SAMPLE_NOTIFICATION), {
        webhookUrl: 'https://10.255.255.1/services/T000/B000/x',
        timeoutMs: 800,
        allowNonSlackHost: true,
      }),
    );
    const result = await captured.result;
    const elapsed = Date.now() - started;

    assert.equal(result.delivered, false);
    assert.ok(elapsed < 5000, `must fail fast via timeout, took ${elapsed}ms`);
    const allLogged = [...captured.errors, ...captured.warns].join('\n');
    assert.ok(!allLogged.includes('10.255.255.1'), 'endpoint host must not leak into logs');
  });
});

// ---------------------------------------------------------------------------
// Approval-flow isolation guarantees
// ---------------------------------------------------------------------------
describe('approval flow isolation', () => {
  test('notification object carries no operational capability', () => {
    const payload = buildSlackPayload(SAMPLE_NOTIFICATION);
    const serialized = JSON.stringify(payload);
    // The message may reference the recommendation, but must not imply that
    // Slack itself executes anything.
    assert.ok(serialized.includes('route through the ClearSet console'));
    assert.ok(serialized.includes('Nothing is dispatched without explicit analyst authorization'));
  });
});
