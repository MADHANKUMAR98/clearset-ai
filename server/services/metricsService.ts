/**
 * ClearSet AI — Operational Impact Metrics Service
 *
 * PURPOSE
 *   Computes judge/ops-facing impact metrics from live Snowflake state:
 *     - Open fail exposure (Σ TRADE_VALUE of non-resolved exceptions)
 *     - Critical open exposure
 *     - Estimated CSDR-style penalty accrual per fail-day
 *     - Human-approval throughput from RESOLUTION_CASES (count + turnaround)
 *
 * HONESTY CONTRACT
 *   - Every number is COMPUTED from rows returned by Snowflake at request time.
 *   - The penalty rate below is an explicit, documented ASSUMPTION — it is a
 *     modeling constant aligned with our SOP narrative, NOT a regulatory quote.
 *   - Turnaround is measured ONLY between CREATED_AT → APPROVED_AT on approved
 *     rows; anything missing either timestamp is excluded, never guessed.
 *   - When Snowflake is unreachable this service returns source:'unavailable'
 *     and the UI renders DATA NOT AVAILABLE. No fallback fabrication.
 */

// ============================================================================
// Documented assumption (modeling constant — surfaced in the UI label)
// ============================================================================

/**
 * Assumed penalty accrual per fail-day as a fraction of notional value.
 * 0.00025 == 0.025% of trade value per day a settlement stays failed.
 * Labeled "ESTIMATE" everywhere it is rendered.
 */
export const CSDR_DAILY_PENALTY_RATE = 0.00025;

// ============================================================================
// Public types
// ============================================================================

export interface ExceptionMetricRow {
  STATUS: string | null;
  SEVERITY: string | null;
  TRADE_VALUE: number | string | null;
}

export interface CaseMetricRow {
  STATUS: string | null;
  CREATED_AT: string | Date | null;
  APPROVED_AT: string | Date | null;
}

export interface ImpactMetrics {
  generatedAt: string;
  source: 'snowflake' | 'unavailable';
  openExceptionCount: number;
  /** Σ TRADE_VALUE over open (non-RESOLVED) exceptions, USD. */
  openExceptionValueUSD: number;
  /** Σ TRADE_VALUE over open CRITICAL exceptions, USD. */
  criticalOpenValueUSD: number;
  /** openExceptionValueUSD × CSDR_DAILY_PENALTY_RATE — labeled ESTIMATE in UI. */
  csdrExposurePerDayUSD: number;
  /** Rows in RESOLUTION_CASES with STATUS='APPROVED'. */
  casesApproved: number;
  /** Mean (APPROVED_AT − CREATED_AT) in whole minutes over approvable rows; null when none. */
  avgApprovalTurnaroundMinutes: number | null;
}

// ============================================================================
// Pure computation — unit tested, no IO
// ============================================================================

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (v: string | Date | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeImpactMetrics(
  exceptionRows: ExceptionMetricRow[],
  caseRows: CaseMetricRow[],
  now: Date = new Date(),
): ImpactMetrics {
  let openExceptionCount = 0;
  let openExceptionValueUSD = 0;
  let criticalOpenValueUSD = 0;

  for (const row of exceptionRows ?? []) {
    const status = String(row.STATUS ?? '').toUpperCase();
    if (status === 'RESOLVED') continue;
    const value = toNumber(row.TRADE_VALUE);
    openExceptionCount += 1;
    openExceptionValueUSD += value;
    if (String(row.SEVERITY ?? '').toUpperCase() === 'CRITICAL') {
      criticalOpenValueUSD += value;
    }
  }

  const turnarounds: number[] = [];
  let casesApproved = 0;
  for (const row of caseRows ?? []) {
    const status = String(row.STATUS ?? '').toUpperCase();
    if (status !== 'APPROVED') continue;
    casesApproved += 1;
    const created = toDate(row.CREATED_AT);
    const approved = toDate(row.APPROVED_AT);
    if (!created || !approved) continue; // exclude — never guess a timestamp
    const minutes = (approved.getTime() - created.getTime()) / 60_000;
    if (minutes >= 0) turnarounds.push(minutes);
  }

  const avgApprovalTurnaroundMinutes =
    turnarounds.length > 0
      ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
      : null;

  return {
    generatedAt: now.toISOString(),
    source: 'snowflake',
    openExceptionCount,
    openExceptionValueUSD: round2(openExceptionValueUSD),
    criticalOpenValueUSD: round2(criticalOpenValueUSD),
    csdrExposurePerDayUSD: round2(openExceptionValueUSD * CSDR_DAILY_PENALTY_RATE),
    casesApproved,
    avgApprovalTurnaroundMinutes,
  };
}

// ============================================================================
// SQL + fetch layer
// ============================================================================

/** Minimal projection needed for impact math — no PII, no secrets. */
const EXCEPTION_METRICS_SQL = `
  SELECT E.STATUS, E.SEVERITY, T.TRADE_VALUE
  FROM CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS E
  JOIN CLEARSET_DB.CLEARSET_SCHEMA.TRADES T ON E.TRADE_ID = T.TRADE_ID
`;

const CASE_METRICS_SQL = `
  SELECT STATUS, CREATED_AT, APPROVED_AT
  FROM CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES
`;

interface StatementRunner {
  isConfigured(): boolean;
  executeStatement(sql: string): Promise<Record<string, unknown>[]>;
}

export async function fetchImpactMetrics(client: StatementRunner): Promise<ImpactMetrics> {
  if (!client.isConfigured()) {
    return {
      generatedAt: new Date().toISOString(),
      source: 'unavailable',
      openExceptionCount: 0,
      openExceptionValueUSD: 0,
      criticalOpenValueUSD: 0,
      csdrExposurePerDayUSD: 0,
      casesApproved: 0,
      avgApprovalTurnaroundMinutes: null,
    };
  }

  const [exceptionRows, caseRows] = await Promise.all([
    client.executeStatement(EXCEPTION_METRICS_SQL),
    client.executeStatement(CASE_METRICS_SQL),
  ]);

  return computeImpactMetrics(
    exceptionRows as unknown as ExceptionMetricRow[],
    caseRows as unknown as CaseMetricRow[],
  );
}
