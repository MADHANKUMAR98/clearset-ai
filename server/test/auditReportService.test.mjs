/**
 * Unit tests — Audit-Ready Resolution Report (auditReportService).
 *
 * Pure-model and PDF-render tests only: no Snowflake connection, no network.
 * The PDF is rendered with compress:false so text is greppable in the buffer.
 * Fixtures below are synthetic test data shaped like production rows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReportError,
  isValidCaseId,
  computeDeterministicFactors,
  finalizeDeterministicAssessment,
  buildReportModel,
  renderAuditPdf,
} from '../dist/services/auditReportService.js';

// ---------------------------------------------------------------------------
// Fixtures (synthetic, deterministic)
// ---------------------------------------------------------------------------
const FIXED_NOW = new Date('2026-08-20T15:00:00.000Z'); // 300 min before cutoff

const FIXTURE_CASE = {
  CASE_ID: 'INV-TEST-0001',
  TRADE_ID: 'TRD-TEST-001',
  EXCEPTION_ID: 'EXC-TEST-001',
  STATUS: 'PENDING_APPROVAL',
  RISK_SCORE: 91,
  ROOT_CAUSE: 'Test fixture root cause: instruction repair pending.',
  RECOMMENDATION: 'Test fixture recommendation.',
  RESOLUTION_OUTCOME: 'Manual instruction repair completed by ops desk (test fixture).',
  APPROVED_BY: 'TEST_APPROVER',
  APPROVED_AT: '2026-08-20T14:30:00.000Z',
  CREATED_AT: '2026-08-20T13:00:00.000Z',
  UPDATED_AT: '2026-08-20T14:30:00.000Z',
};

const FIXTURE_TRADE = {
  TRADE_ID: 'TRD-TEST-001',
  ISIN: 'US0378331005',
  TICKER: 'AAPL',
  SECURITY_NAME: 'Apple Inc. (fixture)',
  ASSET_CLASS: 'EQUITY',
  DEPOSITORY: 'DTCC',
  CP_ID: 'CP-TEST-01',
  COUNTERPARTY_NAME: 'Fixture Counterparty LLC',
  CREDIT_RATING: 'A',
  TRADE_DATE: '2026-08-18',
  SETTLEMENT_DATE: '2026-08-20',
  SETTLEMENT_TYPE: 'DTD',
  TRADE_VALUE: 2400000,
  QUANTITY: 12000,
  PRICE: 200,
  CURRENCY: 'USD',
  BOOKING_DESK: 'TEST_DESK',
  SETTLEMENT_STATUS: 'PENDING',
  INSTRUCTION_STATUS: 'MISSING', // top instruction band (+25)
  CUTOFF_TIME: '2026-08-20T20:00:00.000Z',
};

const FIXTURE_CP = {
  CP_ID: 'CP-TEST-01',
  NAME: 'Fixture Counterparty LLC',
  CREDIT_RATING: 'A',
  PRIOR_FAILURES_30D: 6,
  HISTORICAL_FAIL_RATE: 4,
  AVG_RESOLUTION_HOURS: 2.5,
};

const FIXTURE_EVENTS = [
  {
    EVENT_ID: 'EVT-TEST-001',
    MESSAGE_TYPE: 'MT540',
    EVENT_STATUS: 'REJECTED',
    DESCRIPTION: 'Test fixture event one.',
    SOURCE: 'SWIFT',
    EVENT_TIMESTAMP: '2026-08-20T09:15:00.000Z',
  },
];

function unavailableCortex() {
  return {
    search: {
      available: false,
      query: '',
      generatedAt: FIXED_NOW.toISOString(),
      results: [],
      note: 'Cortex Search unavailable at generation time.',
    },
    analyst: {
      available: false,
      question: '',
      generatedAt: FIXED_NOW.toISOString(),
      note: 'Cortex Analyst unavailable at generation time.',
    },
  };
}

function buildFixtureModel(overrides = {}) {
  const caseRow = 'case' in overrides ? overrides.case : { ...FIXTURE_CASE };
  return buildReportModel({
    caseRow,
    trade: overrides.trade === undefined ? { ...FIXTURE_TRADE } : overrides.trade,
    counterparty: overrides.counterparty === undefined ? { ...FIXTURE_CP } : overrides.counterparty,
    settlementEvents: overrides.events ?? FIXTURE_EVENTS.map((e) => ({ ...e })),
    cortexSearch: unavailableCortex().search,
    cortexAnalyst: unavailableCortex().analyst,
    now: overrides.now ?? FIXED_NOW,
  });
}

// ---------------------------------------------------------------------------
// isValidCaseId
// ---------------------------------------------------------------------------
test('isValidCaseId accepts ledger-format IDs and rejects traversal/oversized input', () => {
  assert.equal(isValidCaseId('INV-2026-001'), true);
  assert.equal(isValidCaseId('INV_TEST_9'), false);
  assert.equal(isValidCaseId('../etc/passwd'), false);
  assert.equal(isValidCaseId('a'.repeat(51)), false);
  assert.equal(isValidCaseId(''), false);
});

// ---------------------------------------------------------------------------
// Deterministic factor computation
// ---------------------------------------------------------------------------
test('computeDeterministicFactors scores instruction/cutoff/exposure/counterparty bands', () => {
  const partial = computeDeterministicFactors(FIXTURE_TRADE, FIXTURE_CP, FIXED_NOW);

  const byFactor = Object.fromEntries(partial.factors.map((f) => [f.factor, f.points]));
  // MISSING instruction → 25; 300 min to cutoff (≤480, >240) → 8;
  // $2.4M exposure → 20; 6 prior failures → 15. Total 68.
  assert.equal(byFactor['Missing Settlement Instruction (SSI)'], 25);
  assert.equal(byFactor['Standard Settlement Day Horizon'], 8);
  assert.equal(byFactor['High-Value Transaction Exposure'], 20);
  assert.equal(byFactor['Repeated Counterparty Failure Precedents'], 15);
  assert.equal(partial.subtotal, 68);
  assert.match(partial.cutoffState, /^OPEN/);
  assert.equal(partial.cutoffMinutesRemaining, 300);
});

test('cutoff factor escalates as the window closes and vanishes once breached', () => {
  // 200 minutes remaining → middle band (15).
  const mid = computeDeterministicFactors(FIXTURE_TRADE, FIXTURE_CP, new Date('2026-08-20T16:40:00.000Z'));
  assert.equal(mid.factors.find((f) => f.factor === 'Approaching Intra-day Cutoff Window')?.points, 15);

  // 30 minutes remaining → critical band (25).
  const soon = computeDeterministicFactors(FIXTURE_TRADE, FIXTURE_CP, new Date('2026-08-20T19:30:00.000Z'));
  assert.equal(soon.factors.find((f) => f.factor === 'Depository Cutoff Approaching')?.points, 25);

  // Past cutoff → no fabricated urgency points; state says PAST CUTOFF honestly.
  const late = computeDeterministicFactors(FIXTURE_TRADE, FIXTURE_CP, new Date('2026-08-20T21:00:00.000Z'));
  assert.equal(late.cutoffState.startsWith('PAST CUTOFF'), true);
  assert.equal(late.factors.some((f) => f.category === 'Cutoff Urgency'), false);
});

test('finalizeDeterministicAssessment records an explicit discrepancy when ledger score differs', () => {
  const partial = computeDeterministicFactors(FIXTURE_TRADE, FIXTURE_CP, FIXED_NOW);
  const assessment = finalizeDeterministicAssessment({ ...partial, ledgerScore: 91 });
  assert.equal(assessment.ledgerScore, 91);
  assert.equal(assessment.subtotal, 68);
  assert.match(assessment.discrepancyNote, /Live Snowflake risk score \(91\) differs/);
  assert.match(assessment.discrepancyNote, /historical case-similarity precedent weighting/);
});

// ---------------------------------------------------------------------------
// Model assembly honesty rules
// ---------------------------------------------------------------------------
test('buildReportModel throws ReportError(CASE_NOT_FOUND) without a persisted case row', () => {
  assert.throws(
    () => buildFixtureModel({ case: null }),
    (err) => err instanceof ReportError && err.code === 'CASE_NOT_FOUND',
  );
});

test('empty settlement events degrade honestly instead of fabricating evidence', () => {
  const model = buildFixtureModel({ events: [] });
  assert.equal(model.settlementEventsEmptyMessage, 'No settlement events recorded');
  assert.equal(model.settlementEvents.length, 0);
});

test('approval metadata is preserved verbatim from the ledger row', () => {
  const model = buildFixtureModel({});
  assert.equal(model.approvedBy, 'TEST_APPROVER');
  assert.equal(model.approvedAt, '2026-08-20T14:30:00.000Z');
  assert.equal(
    model.resolutionOutcome,
    'Manual instruction repair completed by ops desk (test fixture).',
  );
});

test('missing supporting evidence is labeled unavailable, never substituted', () => {
  const model = buildFixtureModel({ trade: null, counterparty: null });
  assert.equal(model.trade, null);
  assert.equal(model.counterparty, null);
  assert.match(model.investigationSteps[0].evidenceInReport, /Trade master record unavailable at generation time/);
});

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

/**
 * PDFKit writes glyph runs as hex strings inside TJ arrays, splitting tokens
 * wherever kerning adjustments occur. Reassembling every hex run in stream
 * order recovers contiguous document text for assertion purposes.
 */
function extractPdfText(buf) {
  const latin = buf.toString('latin1');
  const hexes = [...latin.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => m[1]);
  return Buffer.from(hexes.join(''), 'hex').toString('latin1');
}

test('renderAuditPdf produces a valid PDF containing the case narrative', async () => {
  const model = buildFixtureModel({});
  const buffer = await renderAuditPdf(model, { compress: false });

  assert.equal(buffer.length > 1000, true);
  assert.equal(buffer.toString('latin1').startsWith('%PDF'), true);
  const text = extractPdfText(buffer);
  assert.match(text, /INV-TEST-0001/);
  assert.match(text, /TRD-TEST-001/);
  assert.match(text, /Settlement Risk Resolution Report/i);
  assert.match(text, /Test fixture event one/); // persisted event reproduced
  assert.match(text, /Provenance note:/);
  assert.match(text, /TEST_APPROVER/);
  assert.match(text, /APPENDIX A\. DATA PROVENANCE LEGEND/i);
});

test('a case with no settlement events renders the honest empty-state message', async () => {
  const model = buildFixtureModel({ events: [] });
  const buffer = await renderAuditPdf(model, { compress: false });
  assert.match(extractPdfText(buffer), /No settlement events recorded/);
});

test('page footers carry the audit statements and page numbers', async () => {
  const model = buildFixtureModel({});
  const buffer = await renderAuditPdf(model, { compress: false });
  const latin = buffer.toString('latin1');
  const text = extractPdfText(buffer);
  assert.match(text, /No autonomous settlement action was executed/);
  assert.match(text, /Page 1 of/);
  // Footer repeats on every buffered page (content + appendix).
  const pageCount = (text.match(/Page \d+ of/g) || []).length;
  assert.equal(pageCount >= 2, true);
});

test('rendered PDF contains no credentials or internal hostnames', async () => {
  const model = buildFixtureModel({});
  const buffer = await renderAuditPdf(model, { compress: false });
  const latin = buffer.toString('latin1');
  for (const forbidden of ['password', 'PASSWORD', 'SECRET', 'Bearer ', 'hooks.slack.com', 'snowflakecomputing.com', 'ziaihbo', 'BEGIN PRIVATE']) {
    assert.equal(latin.includes(forbidden), false, `PDF must not contain '${forbidden}'`);
  }
});

test('timestamps in the PDF come from real inputs, not invented values', async () => {
  const model = buildFixtureModel({});
  const buffer = await renderAuditPdf(model, { compress: false });
  const text = extractPdfText(buffer);
  // generatedAt equals the provided clock; approved/created stamps echo ledger values verbatim.
  assert.equal(text.includes(model.generatedAt), true);
  assert.equal(text.includes('2026-08-20T14:30:00'), true);
  assert.equal(text.includes('2026-08-20T13:00:00'), true);
});
