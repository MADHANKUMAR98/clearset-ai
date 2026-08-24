import https from 'https';

/**
 * ClearSet AI — Slack Integration Service
 *
 * PURPOSE
 *   Makes the EXISTING human-in-the-loop approval workflow visible outside the
 *   application. When a critical investigation reaches the recommendation /
 *   approval stage, an optional Slack notification is posted summarizing the
 *   exception and pointing the analyst back into ClearSet.
 *
 * SECURITY MODEL (non-negotiable)
 *   - Slack NEVER bypasses approval logic. The only path that creates a case or
 *     triggers any operational action remains POST /api/cases from within the
 *     authenticated application.
 *   - This service is notification-only. It cannot dispatch SWIFT messages,
 *     modify trades, or write to Snowflake.
 *   - The webhook URL is read from the environment at call time and is never
 *     logged, returned by any API, or sent to the frontend.
 *   - Every error message is sanitized to strip URLs before logging.
 *
 * FEATURE FLAG
 *   SLACK_ENABLED=false  → zero behavior change; no outbound request is ever
 *   attempted. The integration is completely inert unless explicitly enabled.
 *
 * INTERACTIVE BUTTONS (documented limitation)
 *   True [APPROVE] / [REJECT] / [REQUEST MORE EVIDENCE] buttons require a Slack
 *   App with Interactivity enabled and a PUBLIC HTTPS Request URL that Slack
 *   can POST to when a user clicks. Incoming webhooks are one-way and cannot
 *   receive click events. Additionally:
 *     - The SPCS public endpoint sits behind Snowflake SSO, so Slack's callback
 *       handshake would be redirected to an SSO login and fail verification.
 *     - Exposing an unauthenticated public callback would weaken the security
 *       posture of this system and is intentionally NOT done here.
 *   Therefore this implementation renders the three approval actions as clearly
 *   labeled guidance text directing the analyst back into ClearSet. The buttons
 *   are deliberately NOT fake-interactive. See README / final report for the
 *   full production architecture if interactivity is ever required.
 */

// ============================================================================
// Types
// ============================================================================

export type SlackProvenance = 'LIVE SNOWFLAKE' | 'COMPUTED' | 'LOCAL FALLBACK';

export interface CriticalExceptionNotification {
  tradeId: string;
  exceptionType: string;
  severity: string;
  riskScore: number;
  tradeValue: number | string;
  currency?: string;
  counterpartyName: string;
  counterpartyId?: string;
  rootCause: string;
  recommendedResolution: string;
  applicableSop?: string;
  /** Where the underlying data came from — shown verbatim in Slack. */
  provenance: SlackProvenance;
  /** Backend mode at send time ('snowflake' | 'local'). */
  dataMode?: 'snowflake' | 'local';
}

export interface SlackStatusSummary {
  enabled: boolean;
  configured: boolean;
  /** 'ENABLED' = flag on + webhook present. Never contains the URL itself. */
  mode: 'ENABLED' | 'DISABLED' | 'NOT_CONFIGURED';
}

export interface SlackDeliveryResult {
  delivered: boolean;
  /** Machine-readable reason on failure: SLACK_DISABLED | SLACK_NOT_CONFIGURED | SLACK_INVALID_WEBHOOK | HTTP_<code> | DELIVERY_ERROR */
  reason?: string;
}

interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

// ============================================================================
// Configuration helpers — env is read lazily so tests can toggle flags.
// ============================================================================

const WEBHOOK_PREFIX = 'https://hooks.slack.com/';

export function isSlackEnabled(): boolean {
  return process.env.SLACK_ENABLED === 'true';
}

/**
 * Returns the configured webhook URL only if it is well-formed.
 * A non-Slack URL is treated as invalid configuration, not as a destination —
 * this prevents accidental exfiltration to arbitrary hosts via misconfig.
 */
export function getSlackWebhookUrl(): string | null {
  const url = process.env.SLACK_WEBHOOK_URL || '';
  return url.startsWith(WEBHOOK_PREFIX) ? url : null;
}

export function getSlackStatusSummary(): SlackStatusSummary {
  const enabled = isSlackEnabled();
  const configured = getSlackWebhookUrl() !== null;
  const mode: SlackStatusSummary['mode'] =
    enabled && configured ? 'ENABLED' : !enabled ? 'DISABLED' : 'NOT_CONFIGURED';
  return { enabled, configured, mode };
}

/** Strips anything URL-shaped from a message before it can reach a log. */
function sanitizeForLogs(message: string): string {
  return String(message).replace(/https?:\/\/\S+/g, '[redacted-url]');
}

// ============================================================================
// Payload construction (pure — unit tested directly)
// ============================================================================

/** Slack section text blocks cap out around 3000 chars — stay safely under. */
function truncate(text: string, maxLen = 2900): string {
  const clean = String(text ?? '').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 3)}...`;
}

function formatTradeValue(value: number | string, currency?: string): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency && currency.trim() ? currency.trim() + ' ' : '$'}${formatted}`;
}

/**
 * Builds the Block Kit payload for a critical-exception approval alert.
 * Pure function — no network, no env access, fully deterministic.
 */
export function buildSlackPayload(notification: CriticalExceptionNotification): SlackPayload {
  const n = notification;

  const headerBlock: SlackBlock = {
    type: 'header',
    text: { type: 'plain_text', text: ':rotating_light: ClearSet AI — Critical Settlement Exception', emoji: true },
  };

  const identitySection: SlackBlock = {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Trade ID*\n\`${truncate(n.tradeId, 80)}\`` },
      { type: 'mrkdwn', text: `*Exception Type*\n${truncate(n.exceptionType, 120)}` },
      { type: 'mrkdwn', text: `*Severity*\n:${severityEmoji(n.severity)} ${truncate(n.severity.toUpperCase(), 40)}` },
      { type: 'mrkdwn', text: `*Risk Score*\n*${Number(n.riskScore) || 0}/100*` },
    ],
  };

  const exposureSection: SlackBlock = {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Trade Value*\n${formatTradeValue(n.tradeValue, n.currency)}` },
      {
        type: 'mrkdwn',
        text: `*Counterparty*\n${truncate(n.counterpartyName, 120)}${n.counterpartyId ? ` (\`${truncate(n.counterpartyId, 40)}\`)` : ''}`,
      },
    ],
  };

  const rootCauseSection: SlackBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `*Root Cause*\n${truncate(n.rootCause)}` },
  };

  const recommendationSection: SlackBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `*Recommended Resolution*\n${truncate(n.recommendedResolution)}` },
  };

  const blocks: SlackBlock[] = [
    headerBlock,
    identitySection,
    exposureSection,
    rootCauseSection,
    recommendationSection,
  ];

  if (n.applicableSop && n.applicableSop.trim()) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Applicable SOP*\n:book: ${truncate(n.applicableSop, 200)}` },
    } as SlackBlock);
  }

  // Provenance transparency — the same doctrine as the in-app badges.
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `:database: Data provenance: *${truncate(n.provenance, 40)}*${n.dataMode ? ` · backend mode: \`${n.dataMode}\`` : ''}`,
      },
    ],
  } as SlackBlock);

  // Approval actions — CONCEPTUAL ONLY. Incoming webhooks cannot deliver
  // interactive buttons; clicks must happen inside ClearSet where the
  // human-in-the-loop gate and audit ledger live.
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        '*Approval Actions* (route through the ClearSet console)',
        `[ APPROVE ]   [ REJECT ]   [ REQUEST MORE EVIDENCE ]`,
        '_Open the investigation workspace in ClearSet AI to act on this exception._',
      ].join('\n'),
    },
  } as SlackBlock);

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: ':warning: *HUMAN APPROVAL REQUIRED* — No operational action has been taken. Nothing is dispatched without explicit analyst authorization inside ClearSet AI.',
      },
    ],
  } as SlackBlock);

  const fallbackText = truncate(
    `ClearSet AI — ${n.severity} settlement exception on ${n.tradeId} ` +
      `(risk ${Number(n.riskScore) || 0}/100). Human approval required.`,
    300,
  );

  return { text: fallbackText, blocks };
}

function severityEmoji(severity: string): string {
  switch (String(severity).toUpperCase()) {
    case 'CRITICAL':
      return 'fire';
    case 'HIGH':
      return 'a';
    case 'MEDIUM':
      return 'b';
    default:
      return 'white_circle';
  }
}

// ============================================================================
// Delivery
// ============================================================================

/**
 * Low-level webhook POST. Exported for tests only — callers should use
 * notifyCriticalException(). Rejects non-Slack webhook hosts as a safeguard.
 * `allowNonSlackHost` exists solely so tests can exercise transport failures
 * against a local endpoint; production callers never pass it.
 */
export function sendSlackRaw(
  payload: SlackPayload,
  options: {
    webhookUrl: string;
    timeoutMs?: number;
    /** TESTS ONLY — disables the hooks.slack.com host guard. */
    allowNonSlackHost?: boolean;
  },
): Promise<SlackDeliveryResult> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(options.webhookUrl);
    } catch {
      resolve({ delivered: false, reason: 'SLACK_INVALID_WEBHOOK' });
      return;
    }

    const isSlackWebhook =
      url.protocol === 'https:' &&
      url.host.endsWith('.slack.com') &&
      url.pathname.startsWith('/services/');

    if (!options.allowNonSlackHost && !isSlackWebhook) {
      resolve({ delivered: false, reason: 'SLACK_INVALID_WEBHOOK' });
      return;
    }
    if (url.protocol !== 'https:') {
      resolve({ delivered: false, reason: 'SLACK_INVALID_WEBHOOK' });
      return;
    }

    const body = JSON.stringify(payload);
    const request = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'ClearSetAI/1.0',
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          clearTimeout(timer);
          if (response.statusCode === 200 && data.trim() === 'ok') {
            resolve({ delivered: true });
          } else {
            // Log status only — never the URL or response body (may echo config).
            console.error('[Slack] delivery failed with HTTP %d', response.statusCode);
            resolve({ delivered: false, reason: `HTTP_${response.statusCode ?? 'UNKNOWN'}` });
          }
        });
      },
    );

    // Explicit wall-clock abort: covers connect stalls where socket-level
    // timeouts never fire (e.g. unroutable hosts on Windows).
    const timer = setTimeout(() => {
      request.destroy(new Error('Slack webhook request timed out'));
    }, options.timeoutMs ?? 10_000);

    request.on('error', (err) => {
      clearTimeout(timer);
      console.error('[Slack] notification delivery failed:', sanitizeForLogs(err?.message || 'unknown error'));
      resolve({ delivered: false, reason: 'DELIVERY_ERROR' });
    });

    request.write(body);
    request.end();
  });
}

/**
 * Orchestrates a critical-exception notification end-to-end.
 * GUARANTEE: never throws. A Slack failure degrades to a logged warning and a
 * structured result — investigation and approval flows are never impacted.
 */
export async function notifyCriticalException(
  notification: CriticalExceptionNotification,
  timeoutMs?: number,
): Promise<SlackDeliveryResult & { slack: SlackStatusSummary }> {
  const slack = getSlackStatusSummary();

  if (!slack.enabled) {
    return { delivered: false, reason: 'SLACK_DISABLED', slack };
  }
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) {
    console.warn('[Slack] notifications enabled but SLACK_WEBHOOK_URL missing or invalid — skipping');
    return { delivered: false, reason: 'SLACK_NOT_CONFIGURED', slack };
  }

  try {
    const payload = buildSlackPayload(notification);
    const result = await sendSlackRaw(payload, { webhookUrl, timeoutMs });
    if (result.delivered) {
      console.log('[Slack] critical-exception notification delivered for %s', sanitizeForLogs(notification.tradeId));
    }
    return { ...result, slack };
  } catch (err: any) {
    console.error('[Slack] unexpected failure:', sanitizeForLogs(err?.message || 'unknown error'));
    return { delivered: false, reason: 'DELIVERY_ERROR', slack };
  }
}
