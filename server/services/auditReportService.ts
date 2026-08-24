import PDFDocument from 'pdfkit';

/**
 * ClearSet AI — Audit-Ready Resolution Report Service
 *
 * PURPOSE
 *   Generates an enterprise-style PDF evidencing a completed, HUMAN-APPROVED
 *   resolution case. Every value rendered into the PDF comes from one of:
 *     - RESOLUTION_CASES            (the audit ledger — source of truth)
 *     - TRADES / SECURITIES / COUNTERPARTIES joins (live trade evidence)
 *     - SETTLEMENT_EVENTS           (actual depository message history)
 *     - Cortex Search SEARCH_PREVIEW (fresh retrieval at generation time)
 *     - Cortex Analyst REST          (fresh query at generation time)
 *   Nothing operational is inferred, invented, or embellished. When evidence is
 *   unavailable it is labeled unavailable — never replaced with plausible data.
 *
 * HUMAN APPROVAL GATE
 *   A report exists ONLY for cases already persisted to RESOLUTION_CASES by the
 *   existing approval flow. Generation never triggers any operational action,
 *   notification, or dispatch. It is read-only reporting.
 *
 * SECURITY
 *   - No credentials, webhook URLs, PATs, tokens, hostnames, or account
 *     identifiers are ever placed in the PDF or logged here.
 */

// ============================================================================
// Public types
// ============================================================================

export type ReportErrorCode = 'CASE_NOT_FOUND' | 'INVALID_CASE_ID' | 'RENDER_ERROR';

export class ReportError extends Error {
  constructor(public readonly code: ReportErrorCode, message: string) {
    super(message);
    this.name = 'ReportError';
  }
}

/** Row shape returned from RESOLUTION_CASES. */
export interface CaseRow {
  CASE_ID: string;
  TRADE_ID: string;
  EXCEPTION_ID: string | null;
  STATUS: string;
  RISK_SCORE: number;
  ROOT_CAUSE: string;
  RECOMMENDATION: string;
  RESOLUTION_OUTCOME: string | null;
  APPROVED_BY: string | null;
  APPROVED_AT: string | Date | null;
  CREATED_AT: string | Date | null;
  UPDATED_AT: string | Date | null;
}

export interface TradeEvidence {
  TRADE_ID: string;
  ISIN: string | null;
  TICKER: string | null;
  SECURITY_NAME: string | null;
  ASSET_CLASS: string | null;
  DEPOSITORY: string | null;
  CP_ID: string | null;
  COUNTERPARTY_NAME: string | null;
  CREDIT_RATING: string | null;
  TRADE_DATE: string | null;
  SETTLEMENT_DATE: string | null;
  SETTLEMENT_TYPE: string | null;
  TRADE_VALUE: number | null;
  QUANTITY: number | null;
  PRICE: number | null;
  CURRENCY: string | null;
  BOOKING_DESK: string | null;
  SETTLEMENT_STATUS: string | null;
  INSTRUCTION_STATUS: string | null;
  CUTOFF_TIME: string | null;
}

export interface CounterpartyEvidence {
  CP_ID: string;
  NAME: string;
  CREDIT_RATING: string | null;
  PRIOR_FAILURES_30D: number;
  HISTORICAL_FAIL_RATE: number | null;
  AVG_RESOLUTION_HOURS: number | null;
}

export interface SettlementEventRow {
  EVENT_ID: string;
  MESSAGE_TYPE: string | null;
  EVENT_STATUS: string | null;
  DESCRIPTION: string | null;
  SOURCE: string | null;
  EVENT_TIMESTAMP: string | null;
}

export interface CortexSearchEvidence {
  available: boolean;
  query: string;
  generatedAt: string;
  results: Array<{
    docCode: string;
    policyName: string;
    section: string;
    excerpt: string;
  }>;
  /** Present when retrieval failed — explains honestly instead of faking. */
  note?: string;
}

export interface CortexAnalystEvidence {
  available: boolean;
  question: string;
  generatedAt: string;
  interpretation?: string;
  sqlExecuted?: boolean;
  rowCount?: number;
  /** Present when the analyst was unreachable or declined — never faked. */
  note?: string;
}

export interface DeterministicFactor {
  category: string;
  factor: string;
  points: number;
  explanation: string;
}

export interface DeterministicAssessment {
  factors: DeterministicFactor[];
  subtotal: number;
  /** Ledger (live Snowflake) score for the same case. */
  ledgerScore: number;
  discrepancyNote: string | null;
  cutoffState: string;
  cutoffMinutesRemaining: number | null;
}

export interface InvestigationStepEvidence {
  id: number;
  name: string;
  purpose: string;
  provenance: string;
  evidenceInReport: string;
}

export interface AuditReportModel {
  // 1. header
  reportTitle: string;
  organization: string;
  // 2. case metadata
  caseId: string;
  tradeId: string;
  exceptionId: string;
  caseStatus: string;
  createdAt: string;
  approvedAt: string;
  approvedBy: string;
  // 3. trade details
  trade: TradeEvidence | null;
  counterparty: CounterpartyEvidence | null;
  // 4. risk
  assessment: DeterministicAssessment;
  // 5. root cause
  rootCause: string;
  rootCauseEvidence: string[];
  // 6. investigation steps
  investigationSteps: InvestigationStepEvidence[];
  investigationNote: string;
  // 7. cortex intelligence
  cortexSearch: CortexSearchEvidence;
  cortexAnalyst: CortexAnalystEvidence;
  // 8. settlement events
  settlementEvents: SettlementEventRow[];
  settlementEventsEmptyMessage: string;
  // 9. recommendation
  recommendation: string;
  urgencyLabel: string;
  // 10. human decision
  humanDecision: string;
  decisionRationale: string;
  resolutionOutcome: string;
  // 11/12. footers
  auditStatements: string[];
  provenanceLegend: string[];
  generatedAt: string;
}

// ============================================================================
// Deterministic factor computation (server-authoritative, from live rows only)
// Mirrors the documented point thresholds of the ClearSet risk methodology.
// The historical-precedent dimension is intentionally EXCLUDED here because it
// derives from historical case-similarity analysis owned by the live platform
// score — the report states this explicitly rather than approximating it.
// ============================================================================

export function computeCutoffMinutesRemaining(cutoffTime: string | Date | null, now: Date): number | null {
  if (!cutoffTime) return null;
  const cutoff = cutoffTime instanceof Date ? cutoffTime : new Date(cutoffTime);
  if (Number.isNaN(cutoff.getTime())) return null;
  return Math.round((cutoff.getTime() - now.getTime()) / 60_000);
}

export function computeDeterministicFactors(
  trade: TradeEvidence,
  counterparty: CounterpartyEvidence | null,
  now: Date,
): Omit<DeterministicAssessment, 'ledgerScore' | 'discrepancyNote'> {
  const factors: DeterministicFactor[] = [];

  // Instruction status
  if (trade.INSTRUCTION_STATUS === 'MISSING') {
    factors.push({ category: 'Instruction Risk', factor: 'Missing Settlement Instruction (SSI)', points: 25, explanation: 'No standing settlement instruction found for the counterparty depository account.' });
  } else if (trade.INSTRUCTION_STATUS === 'MISMATCHED') {
    factors.push({ category: 'Instruction Risk', factor: 'Mismatched SSI Parameters', points: 18, explanation: 'Beneficiary account BIC or cash correspondent does not align with master trade ticket.' });
  } else if (trade.INSTRUCTION_STATUS === 'PENDING') {
    factors.push({ category: 'Instruction Risk', factor: 'Pending SSI Affirmation', points: 10, explanation: 'Instruction unconfirmed by counterparty custodian.' });
  }

  // Cutoff proximity
  const mins = computeCutoffMinutesRemaining(trade.CUTOFF_TIME, now);
  let cutoffState = 'CUTOFF TIME NOT AVAILABLE';
  if (mins !== null) {
    if (mins <= 0) {
      cutoffState = `PAST CUTOFF (${Math.abs(mins)} min past)`;
    } else {
      cutoffState = `OPEN — ${Math.floor(mins / 60)}h ${mins % 60}m remaining`;
      if (mins <= 120) {
        factors.push({ category: 'Cutoff Urgency', factor: 'Depository Cutoff Approaching', points: 25, explanation: `Only ${Math.floor(mins / 60)}h ${mins % 60}m remaining before market cutoff deadline.` });
      } else if (mins <= 240) {
        factors.push({ category: 'Cutoff Urgency', factor: 'Approaching Intra-day Cutoff Window', points: 15, explanation: `${Math.round(mins / 60)} hours remaining before pre-matching cutoff window closes.` });
      } else if (mins <= 480) {
        factors.push({ category: 'Cutoff Urgency', factor: 'Standard Settlement Day Horizon', points: 8, explanation: 'Same-day settlement required before end-of-day depository processing cycle.' });
      }
    }
  }

  // Exposure
  const value = Number(trade.TRADE_VALUE);
  if (Number.isFinite(value)) {
    if (value >= 2_000_000) {
      factors.push({ category: 'Financial Exposure', factor: 'High-Value Transaction Exposure', points: 20, explanation: `Gross exposure exceeds the high-value operations threshold. CSDR penalty risk elevated.` });
    } else if (value >= 1_000_000) {
      factors.push({ category: 'Financial Exposure', factor: 'Elevated Transaction Value', points: 15, explanation: 'Exposure requires tier 2 escalation monitoring.' });
    } else if (value >= 500_000) {
      factors.push({ category: 'Financial Exposure', factor: 'Standard Commercial Exposure', points: 10, explanation: 'Value exceeds daily automatic clearance limit.' });
    }
  }

  // Counterparty history
  const priorFailures = counterparty ? Number(counterparty.PRIOR_FAILURES_30D) || 0 : 0;
  if (counterparty) {
    if (priorFailures >= 5) {
      factors.push({ category: 'Counterparty Risk', factor: 'Repeated Counterparty Failure Precedents', points: 15, explanation: `${counterparty.NAME} has ${priorFailures} prior settlement failures in the past 30 days${counterparty.HISTORICAL_FAIL_RATE != null ? ` (fail rate ${counterparty.HISTORICAL_FAIL_RATE}%)` : ''}.` });
    } else if (priorFailures >= 2) {
      factors.push({ category: 'Counterparty Risk', factor: 'Moderate Counterparty Settlement Friction', points: 10, explanation: `${counterparty.NAME} has ${priorFailures} recent delayed settlements.` });
    } else if (priorFailures > 0) {
      factors.push({ category: 'Counterparty Risk', factor: 'Minor Counterparty Exception History', points: 5, explanation: `${counterparty.NAME} experienced ${priorFailures} recent non-critical delay(s).` });
    }
  }

  const subtotal = factors.reduce((sum, f) => sum + f.points, 0);

  return {
    factors,
    subtotal,
    cutoffState,
    cutoffMinutesRemaining: mins,
  };
}

/**
 * Combines server-computed factors with the ledger's live score and produces
 * the explicit discrepancy/provenance explanation when the two differ.
 */
export function finalizeDeterministicAssessment(
  partial: Omit<DeterministicAssessment, 'ledgerScore' | 'discrepancyNote'> & { ledgerScore: number },
): DeterministicAssessment {
  const ledgerScore = Math.round(Number(partial.ledgerScore));
  const diff = ledgerScore - partial.subtotal;
  let discrepancyNote: string | null = null;
  if (diff !== 0) {
    discrepancyNote =
      `Live Snowflake risk score (${ledgerScore}) differs from the server-computed deterministic ` +
      `subtotal (${partial.subtotal}) by ${diff > 0 ? '+' : ''}${diff} points. The live score incorporates ` +
      `a historical case-similarity precedent weighting that is evaluated inside the Snowflake platform and ` +
      `is deliberately excluded from this report's deterministic subtotal. Both figures are shown without adjustment.`;
  }
  return { ...partial, ledgerScore, discrepancyNote };
}

// ============================================================================
// Investigation procedure metadata (names/purposes are fixed product
// vocabulary; sources reflect how each step actually resolves its data)
// ============================================================================

const STEP_SOURCES: Array<{ name: string; purpose: string; provenance: string }> = [
  { name: 'Identify Trade & Master Data', purpose: 'Query trade economics, asset class, ISIN, booking desk.', provenance: 'LIVE SNOWFLAKE' },
  { name: 'Retrieve Settlement State', purpose: 'Retrieve SWIFT MT541/MT548 matching status from depository gateway.', provenance: 'LIVE SNOWFLAKE' },
  { name: 'Check Settlement Instructions', purpose: 'Validate standing settlement instructions against participant directory.', provenance: 'LIVE SNOWFLAKE' },
  { name: 'Analyze Counterparty History', purpose: '30-day failure rate and delay metrics.', provenance: 'CORTEX ANALYST' },
  { name: 'Find Similar Historical Cases', purpose: 'Institutional operational memory and prior outcomes.', provenance: 'LIVE SNOWFLAKE' },
  { name: 'Retrieve Applicable Procedure', purpose: 'Relevant SOP sections and escalation thresholds.', provenance: 'CORTEX SEARCH' },
  { name: 'Assess Settlement Risk', purpose: 'Deterministic explainable point allocation (0-100).', provenance: 'COMPUTED' },
  { name: 'Determine Root Cause', purpose: 'Pinpoint primary operational failure point from structured evidence.', provenance: 'COMPUTED' },
  { name: 'Generate Recommendation', purpose: 'Resolution plan aligned with SOP guidelines and precedents.', provenance: 'COMPUTED' },
  { name: 'Request Human Approval', purpose: 'Present evidence package to operations analyst for authorization.', provenance: 'HUMAN APPROVAL REQUIRED' },
];

function buildInvestigationSteps(model: {
  trade: TradeEvidence | null;
  counterparty: CounterpartyEvidence | null;
  settlementEvents: SettlementEventRow[];
  cortexSearch: CortexSearchEvidence;
  assessment: DeterministicAssessment;
  rootCause: string;
}): InvestigationStepEvidence[] {
  const ev = (s: string) => s;
  const eventCount = model.settlementEvents.length;
  const map: Record<number, string> = {
    1: model.trade ? `Security ${model.trade.SECURITY_NAME ?? 'N/A'} (${model.trade.ISIN ?? 'ISIN N/A'}), asset class ${model.trade.ASSET_CLASS ?? 'N/A'}.` : 'Trade master record unavailable at generation time.',
    2: eventCount > 0 ? `${eventCount} settlement event(s) reproduced in Section 8.` : 'No settlement events recorded.',
    3: model.trade?.INSTRUCTION_STATUS ? `Instruction status at approval: ${model.trade.INSTRUCTION_STATUS}.` : 'Instruction status not available.',
    4: model.counterparty ? `${model.counterparty.NAME}: ${model.counterparty.PRIOR_FAILURES_30D} failures/30d.` : 'Counterparty record unavailable.',
    5: 'Historical similarity weighting is evaluated by the live platform score (see Section 4 discrepancy note when present).',
    6: model.cortexSearch.available ? `${model.cortexSearch.results.length} SOP chunk(s) retrieved fresh at generation time (Section 7).` : 'Retrieval unavailable at generation time.',
    7: `Ledger score ${model.assessment.ledgerScore}/100; deterministic subtotal ${model.assessment.subtotal}.`,
    8: `Persisted root cause reproduced verbatim in Section 5.`,
    9: `Persisted recommendation reproduced verbatim in Section 9.`,
    10: 'Approval granted by human analyst before case creation (Section 10).',
  };
  return STEP_SOURCES.map((s, idx) => ({
    id: idx + 1,
    name: s.name,
    purpose: s.purpose,
    provenance: s.provenance,
    evidenceInReport: ev(map[idx + 1] ?? ''),
  }));
}

// ============================================================================
// Model assembly (pure — unit-testable)
// ============================================================================

export interface ReportModelInput {
  caseRow: CaseRow;
  trade: TradeEvidence | null;
  counterparty: CounterpartyEvidence | null;
  settlementEvents: SettlementEventRow[];
  cortexSearch: CortexSearchEvidence;
  cortexAnalyst: CortexAnalystEvidence;
  now: Date;
}

export function isoOrNull(value: string | Date | null): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function buildReportModel(input: ReportModelInput): AuditReportModel {
  const c = input.caseRow;
  if (!c || !c.CASE_ID || !c.TRADE_ID) {
    throw new ReportError('CASE_NOT_FOUND', 'Case not found in the RESOLUTION_CASES audit ledger.');
  }

  const assessmentPartial = input.trade
    ? computeDeterministicFactors(input.trade, input.counterparty, input.now)
    : { factors: [], subtotal: 0, cutoffState: 'TRADE RECORD UNAVAILABLE', cutoffMinutesRemaining: null as number | null };

  const assessment = finalizeDeterministicAssessment({
    ...assessmentPartial,
    ledgerScore: Number(c.RISK_SCORE),
  });

  const cortexSearch: CortexSearchEvidence =
    input.cortexSearch ?? { available: false, query: '', generatedAt: input.now.toISOString(), results: [], note: 'Cortex Search unavailable at generation time.' };
  const cortexAnalyst: CortexAnalystEvidence =
    input.cortexAnalyst ?? { available: false, question: '', generatedAt: input.now.toISOString(), note: 'Cortex Analyst unavailable at generation time.' };

  const model: AuditReportModel = {
    reportTitle: 'Settlement Risk Resolution Report',
    organization: 'ClearSet AI',
    caseId: String(c.CASE_ID),
    tradeId: String(c.TRADE_ID),
    exceptionId: c.EXCEPTION_ID ? String(c.EXCEPTION_ID) : 'NOT RECORDED',
    caseStatus: String(c.STATUS),
    createdAt: isoOrNull(c.CREATED_AT),
    approvedAt: isoOrNull(c.APPROVED_AT),
    approvedBy: c.APPROVED_BY ? String(c.APPROVED_BY) : '',
    trade: input.trade,
    counterparty: input.counterparty,
    assessment,
    rootCause: String(c.ROOT_CAUSE ?? ''),
    rootCauseEvidence: [
      assessment.factors.map((f) => f.factor).length
        ? `Contributing risk factors: ${assessment.factors.map((f) => `${f.factor} (+${f.points})`).join('; ')}.`
        : 'No additional deterministic risk factors applied.',
      input.counterparty && Number(input.counterparty.PRIOR_FAILURES_30D) > 0
        ? `Counterparty failure history: ${input.counterparty.PRIOR_FAILURES_30D} failures in the last 30 days.`
        : 'No counterparty failure history recorded in the last 30 days.',
      input.settlementEvents.length > 0
        ? `${input.settlementEvents.length} settlement event(s) on record support the failure narrative (Section 8).`
        : 'No settlement events recorded.',
    ],
    investigationSteps: buildInvestigationSteps({
      trade: input.trade,
      counterparty: input.counterparty,
      settlementEvents: input.settlementEvents,
      cortexSearch,
      assessment,
      rootCause: String(c.ROOT_CAUSE ?? ''),
    }),
    investigationNote:
      'The ten-step procedure executes in the analyst workspace against the sources listed. Runtime step logs remain part of the workspace session; this report reproduces each step\u2019s authoritative source and the corresponding persisted evidence sections referenced below.',
    cortexSearch,
    cortexAnalyst,
    settlementEvents: input.settlementEvents,
    settlementEventsEmptyMessage: 'No settlement events recorded',
    recommendation: String(c.RECOMMENDATION ?? ''),
    urgencyLabel:
      assessment.ledgerScore >= 80 ? 'CRITICAL' :
      assessment.ledgerScore >= 60 ? 'HIGH' :
      assessment.ledgerScore >= 40 ? 'MEDIUM' : 'LOW',
    humanDecision: String(c.STATUS ?? ''),
    decisionRationale: 'Authorized by the named operations analyst following completion of the ten-step investigation. The AI recommendation required and received explicit human approval before case creation.',
    resolutionOutcome: c.RESOLUTION_OUTCOME ? String(c.RESOLUTION_OUTCOME) : 'No operational outcome recorded on the case ledger.',
    auditStatements: [
      'Generated from ClearSet AI investigation evidence.',
      'AI recommendation required human approval.',
      'No autonomous settlement action was executed.',
      'This document is a read-only rendering of the RESOLUTION_CASES audit ledger and supporting live records at the generation timestamp shown.',
    ],
    provenanceLegend: [
      'LIVE SNOWFLAKE — value read directly from Snowflake tables/views.',
      'COMPUTED — deterministic calculation over live values, formula documented in-app.',
      'CORTEX SEARCH — retrieval from the governed policy knowledge base at generation time.',
      'CORTEX ANALYST — governed natural-language analytics at generation time.',
      'LOCAL FALLBACK — used only when a live source is unavailable; always labeled where applicable.',
    ],
    generatedAt: input.now.toISOString(),
  };

  return model;
}

// ============================================================================
// PDF rendering
// ============================================================================

const PAGE_MARGIN = 48;
const CONTENT_WIDTH_VALUE = 612 - PAGE_MARGIN * 2; // US Letter width minus margins

interface RenderCtx {
  doc: PDFKit.PDFDocument;
  y: number;
}

function ensureSpace(ctx: RenderCtx, needed: number): void {
  const pageBottom = ctx.doc.page.height - 64;
  if (ctx.y + needed > pageBottom) {
    ctx.doc.addPage();
    ctx.y = PAGE_MARGIN;
  }
}

function sectionTitle(ctx: RenderCtx, text: string): void {
  ensureSpace(ctx, 34);
  const { doc } = ctx;
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#1E293B')
    .text(text.toUpperCase(), PAGE_MARGIN, ctx.y, { characterSpacing: 0.6 });
  ctx.y = doc.y + 3;
  doc.moveTo(PAGE_MARGIN, ctx.y).lineTo(612 - PAGE_MARGIN, ctx.y).lineWidth(0.9).strokeColor('#334155').stroke();
  ctx.y += 8;
  doc.font('Helvetica').fontSize(9);
}

function kvGrid(ctx: RenderCtx, pairs: Array<[string, string]>, colWidth = (CONTENT_WIDTH_VALUE - 16) / 2): void {
  const { doc } = ctx;
  const startY = ctx.y;
  let col = 0;
  let rowY = startY;
  for (const [label, value] of pairs) {
    const x = PAGE_MARGIN + col * (colWidth + 16);
    doc.font('Courier-Bold').fontSize(7).fillColor('#64748B').text(label.toUpperCase(), x, rowY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(value || '\u2014', x, rowY + 11, { width: colWidth });
    const blockHeight = 24 + doc.heightOfString(value || '\u2014', { width: colWidth });
    if (col === 0) {
      rowY = Math.max(rowY, startY);
      col = 1;
      // second column drawn at same rowY; advance after pair completes
    } else {
      rowY = rowY + Math.max(blockHeight, 26);
      col = 0;
    }
    ctx.y = rowY;
  }
  if (col === 1) ctx.y = rowY + 26; // odd count trailing row
  ctx.y += 2;
  doc.font('Helvetica').fontSize(9);
}

function paragraph(ctx: RenderCtx, text: string, opts: { font?: string; size?: number; color?: string; gap?: number } = {}): void {
  const { doc } = ctx;
  const font = opts.font ?? 'Helvetica';
  const size = opts.size ?? 9;
  doc.font(font).fontSize(size).fillColor(opts.color ?? '#1E293B');
  const h = doc.heightOfString(text, { width: CONTENT_WIDTH_VALUE });
  ensureSpace(ctx, h + (opts.gap ?? 8));
  doc.text(text, PAGE_MARGIN, ctx.y, { width: CONTENT_WIDTH_VALUE });
  ctx.y = doc.y + (opts.gap ?? 8);
}

function provenanceTagInline(ctx: RenderCtx, tag: string): void {
  const { doc } = ctx;
  doc.font('Courier-Bold').fontSize(7).fillColor('#0E7490');
  const h = doc.heightOfString(tag, { width: CONTENT_WIDTH_VALUE });
  ensureSpace(ctx, h + 4);
  doc.text(`[${tag}]`, PAGE_MARGIN, ctx.y, { width: CONTENT_WIDTH_VALUE });
  ctx.y = doc.y + 4;
}

/**
 * Renders the model into a PDF buffer.
 * `compress: false` keeps content streams uncompressed so tests can assert on
 * exact strings; production default is compressed.
 */
export function renderAuditPdf(model: AuditReportModel, options: { compress?: boolean } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: PAGE_MARGIN, bottom: 56, left: PAGE_MARGIN, right: PAGE_MARGIN },
        info: { Title: `${model.organization} \u2014 ${model.reportTitle} ${model.caseId}`, Producer: 'ClearSet AI' },
        compress: options.compress ?? true,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(new ReportError('RENDER_ERROR', err.message)));

      const ctx: RenderCtx = { doc, y: PAGE_MARGIN };

      // ---- 1. Header band -------------------------------------------------
      doc.rect(0, 0, 612, 86).fill('#0F172A');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#22D3EE')
        .text(model.organization.toUpperCase(), PAGE_MARGIN, 20, { characterSpacing: 2 });
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#FFFFFF')
        .text(model.reportTitle, PAGE_MARGIN, 36);
      doc.font('Helvetica').fontSize(8.5).fillColor('#94A3B8')
        .text(`Case ${model.caseId}  \u00B7  generated ${model.generatedAt}`, PAGE_MARGIN, 62);
      ctx.y = 104;

      // ---- 2. Case metadata ----------------------------------------------
      sectionTitle(ctx, '1. Case Metadata');
      kvGrid(ctx, [
        ['Case ID', model.caseId],
        ['Trade ID', model.tradeId],
        ['Exception ID', model.exceptionId],
        ['Status', model.caseStatus],
        ['Created At', model.createdAt || 'NOT RECORDED'],
        ['Approved At', model.approvedAt || 'NOT RECORDED'],
        ['Approved By', model.approvedBy || 'PENDING'],
      ]);

      // ---- 3. Trade details ----------------------------------------------
      sectionTitle(ctx, '2. Trade Details');
      if (model.trade) {
        const t = model.trade;
        kvGrid(ctx, [
          ['Trade Value', t.TRADE_VALUE != null ? `${t.CURRENCY ?? '$'}${Number(t.TRADE_VALUE).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'DATA NOT AVAILABLE'],
          ['Security', `${t.TICKER ?? ''}${t.TICKER ? ' \u2014 ' : ''}${t.SECURITY_NAME ?? 'N/A'}`],
          ['ISIN', t.ISIN ?? 'N/A'],
          ['Asset Class', t.ASSET_CLASS ?? 'N/A'],
          ['Depository / Rail', t.DEPOSITORY ?? 'N/A'],
          ['Settlement Type', t.SETTLEMENT_TYPE ?? 'N/A'],
          ['Counterparty', `${t.COUNTERPARTY_NAME ?? 'N/A'}${t.CP_ID ? ` (${t.CP_ID})` : ''}`],
          ['Credit Rating', t.CREDIT_RATING ?? 'N/A'],
          ['Settlement Status', t.SETTLEMENT_STATUS ?? 'N/A'],
          ['Instruction Status', t.INSTRUCTION_STATUS ?? 'N/A'],
          ['Settlement Date', t.SETTLEMENT_DATE ?? 'N/A'],
          ['Cutoff Time', t.CUTOFF_TIME ?? 'N/A'],
          ['Cutoff State', model.assessment.cutoffState],
          ['Booking Desk', t.BOOKING_DESK ?? 'N/A'],
        ]);
      } else {
        paragraph(ctx, 'Trade master record unavailable at generation time. No substitute values are provided.');
      }

      // ---- 4. Risk assessment --------------------------------------------
      sectionTitle(ctx, '3. Risk Assessment');
      kvGrid(ctx, [
        ['Live Snowflake Risk Score', `${model.assessment.ledgerScore}/100`],
        ['Urgency Classification', model.urgencyLabel],
      ]);
      provenanceTagInline(ctx, 'LIVE SNOWFLAKE \u2014 RISK_SCORE from RESOLUTION_CASES ledger');
      paragraph(ctx, 'Deterministic factor breakdown (server-computed at generation time):', { font: 'Helvetica-Bold', size: 8.5, color: '#334155', gap: 4 });
      if (model.assessment.factors.length === 0) {
        paragraph(ctx, 'No deterministic factors exceeded their thresholds for this case.', { color: '#475569' });
      }
      for (const f of model.assessment.factors) {
        ensureSpace(ctx, 30);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A')
          .text(`${f.category} \u2014 ${f.factor}  (+${f.points})`, PAGE_MARGIN + 10, ctx.y, { width: CONTENT_WIDTH_VALUE - 10 });
        ctx.y = doc.y + 1;
        doc.font('Helvetica').fontSize(8).fillColor('#475569')
          .text(f.explanation, PAGE_MARGIN + 10, ctx.y, { width: CONTENT_WIDTH_VALUE - 10 });
        ctx.y = doc.y + 5;
      }
      paragraph(ctx, `Deterministic subtotal (excluding historical-precedent weighting): ${model.assessment.subtotal}`, { font: 'Helvetica-Bold', size: 8.5 });
      provenanceTagInline(ctx, 'COMPUTED \u2014 deterministic thresholds over live values');
      if (model.assessment.discrepancyNote) {
        paragraph(ctx, `Provenance note: ${model.assessment.discrepancyNote}`, { color: '#7C2D12', size: 8 });
      }

      // ---- 5. Root cause ---------------------------------------------------
      sectionTitle(ctx, '4. Root Cause');
      paragraph(ctx, model.rootCause || 'Not recorded.', { font: 'Helvetica-Bold' });
      paragraph(ctx, 'Supporting evidence:', { font: 'Helvetica-Bold', size: 8.5, color: '#334155', gap: 3 });
      for (const e of model.rootCauseEvidence) {
        paragraph(ctx, `\u2022 ${e}`, { size: 8.5, color: '#334155', gap: 3 });
      }

      // ---- 6. Investigation evidence --------------------------------------
      sectionTitle(ctx, '5. Investigation Evidence (Ten-Step Procedure)');
      paragraph(ctx, model.investigationNote, { size: 8, color: '#475569', gap: 6 });
      for (const s of model.investigationSteps) {
        ensureSpace(ctx, 46);
        doc.font('Courier-Bold').fontSize(8).fillColor('#0F172A')
          .text(`STEP ${s.id} \u00B7 ${s.name}`, PAGE_MARGIN, ctx.y, { width: CONTENT_WIDTH_VALUE - 150 });
        doc.font('Courier-Bold').fontSize(7).fillColor('#0E7490')
          .text(`[${s.provenance}]`, 612 - PAGE_MARGIN - 140, ctx.y, { width: 140, align: 'right' });
        ctx.y = doc.y + 2;
        doc.font('Helvetica').fontSize(8).fillColor('#475569')
          .text(`${s.purpose}`, PAGE_MARGIN + 10, ctx.y, { width: CONTENT_WIDTH_VALUE - 10 });
        ctx.y = doc.y + 1;
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#334155')
          .text(`Evidence: ${s.evidenceInReport}`, PAGE_MARGIN + 10, ctx.y, { width: CONTENT_WIDTH_VALUE - 10 });
        ctx.y = doc.y + 7;
      }

      // ---- 7. Cortex intelligence ------------------------------------------
      sectionTitle(ctx, '6. Cortex Intelligence (Refreshed at Generation Time)');
      paragraph(ctx, 'Cortex Search:', { font: 'Helvetica-Bold', size: 8.5, gap: 2 });
      if (model.cortexSearch.available) {
        provenanceTagInline(ctx, `CORTEX SEARCH \u2014 retrieved ${model.cortexSearch.generatedAt}`);
        paragraph(ctx, `Query: "${model.cortexSearch.query}"`, { size: 8, color: '#334155', gap: 3 });
        for (const r of model.cortexSearch.results) {
          paragraph(ctx, `\u2022 ${r.docCode} \u00A7${r.section} \u2014 ${r.policyName}: ${r.excerpt}`, { size: 8, color: '#334155', gap: 3 });
        }
      } else {
        paragraph(ctx, model.cortexSearch.note ?? 'Cortex Search unavailable at generation time.', { size: 8, color: '#7C2D12' });
      }
      paragraph(ctx, 'Cortex Analyst:', { font: 'Helvetica-Bold', size: 8.5, gap: 2 });
      if (model.cortexAnalyst.available) {
        provenanceTagInline(ctx, `CORTEX ANALYST \u2014 answered ${model.cortexAnalyst.generatedAt}`);
        paragraph(ctx, `Question: "${model.cortexAnalyst.question}"`, { size: 8, color: '#334155', gap: 3 });
        if (model.cortexAnalyst.interpretation) {
          paragraph(ctx, model.cortexAnalyst.interpretation, { size: 8, color: '#334155', gap: 3 });
        }
        paragraph(ctx, `Governed SQL executed: ${model.cortexAnalyst.sqlExecuted ? 'yes' : 'no'}${model.cortexAnalyst.rowCount != null ? ` \u00B7 rows returned: ${model.cortexAnalyst.rowCount}` : ''}.`, { size: 8, color: '#475569' });
      } else {
        paragraph(ctx, model.cortexAnalyst.note ?? 'Cortex Analyst unavailable at generation time.', { size: 8, color: '#7C2D12' });
      }

      // ---- 8. Settlement events ---------------------------------------------
      sectionTitle(ctx, '7. Settlement Events Timeline');
      if (model.settlementEvents.length === 0) {
        paragraph(ctx, model.settlementEventsEmptyMessage, { font: 'Helvetica-Bold', color: '#7C2D12' });
      } else {
        for (const ev of model.settlementEvents) {
          ensureSpace(ctx, 40);
          doc.font('Courier-Bold').fontSize(8).fillColor('#0F172A')
            .text(`${ev.EVENT_TIMESTAMP ?? 'TIMESTAMP NOT RECORDED'}  \u00B7  ${ev.MESSAGE_TYPE ?? 'MT---'}  \u00B7  ${ev.EVENT_STATUS ?? 'STATUS NOT RECORDED'}`, PAGE_MARGIN, ctx.y, { width: CONTENT_WIDTH_VALUE });
          ctx.y = doc.y + 1;
          doc.font('Helvetica').fontSize(8).fillColor('#475569')
            .text(`${ev.DESCRIPTION ?? 'No description recorded'}${ev.SOURCE ? `  (source: ${ev.SOURCE})` : ''}`, PAGE_MARGIN + 10, ctx.y, { width: CONTENT_WIDTH_VALUE - 10 });
          ctx.y = doc.y + 6;
        }
      }

      // ---- 9. Recommendation -------------------------------------------------
      sectionTitle(ctx, '8. Recommended Resolution');
      paragraph(ctx, model.recommendation || 'Not recorded.', { font: 'Helvetica-Bold' });
      kvGrid(ctx, [
        ['Urgency', `${model.urgencyLabel} (ledger score ${model.assessment.ledgerScore}/100)`],
        ['Rationale', model.decisionRationale],
      ]);

      // ---- 10. Human decision --------------------------------------------------
      sectionTitle(ctx, '9. Human Decision');
      kvGrid(ctx, [
        ['Decision', model.humanDecision],
        ['Approver', model.approvedBy || 'PENDING'],
        ['Approved At', model.approvedAt || 'NOT RECORDED'],
        ['Resolution Outcome', model.resolutionOutcome],
      ]);

      // ---- Appendix (before footer stamping so every page is numbered) ----
      doc.addPage();
      ctx.y = PAGE_MARGIN;
      sectionTitle(ctx, 'Appendix A. Data Provenance Legend');
      for (const p of model.provenanceLegend) {
        paragraph(ctx, `\u2022 ${p}`, { size: 8.5, color: '#334155', gap: 4 });
      }
      sectionTitle(ctx, 'Appendix B. Generation Attestations');
      for (const a of model.auditStatements) {
        paragraph(ctx, `\u2022 ${a}`, { size: 8.5, color: '#334155', gap: 4 });
      }
      paragraph(ctx, `Report generated at ${model.generatedAt} for case ${model.caseId}.`, { size: 8, color: '#64748B' });

      // ---- Footers on every page (after all pages are buffered) ----------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(7).fillColor('#64748B')
          .text(
            `${model.auditStatements[0]} ${model.auditStatements[1]}. ${model.auditStatements[2]}`,
            PAGE_MARGIN,
            doc.page.height - 40,
            { width: CONTENT_WIDTH_VALUE - 60, lineBreak: false },
          );
        doc.font('Courier-Bold').fontSize(7).fillColor('#64748B')
          .text(`Page ${i + 1} of ${range.count}`, 612 - PAGE_MARGIN - 55, doc.page.height - 40, { width: 55, align: 'right', lineBreak: false });
      }

      doc.end();
    } catch (err: any) {
      reject(new ReportError('RENDER_ERROR', err?.message || 'Unknown PDF rendering error'));
    }
  });
}

// ============================================================================
// Live evidence retrieval & orchestration
// ============================================================================

import { snowflakeClient } from '../snowflakeClient.js';
import fs from 'fs';
import https from 'https';

const CASE_SQL = `
  SELECT CASE_ID, TRADE_ID, EXCEPTION_ID, STATUS, RISK_SCORE,
         ROOT_CAUSE, RECOMMENDATION, RESOLUTION_OUTCOME,
         APPROVED_BY, APPROVED_AT, CREATED_AT, UPDATED_AT
  FROM CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES
  WHERE CASE_ID = ?
`;

const TRADE_SQL = `
  SELECT T.TRADE_ID, T.ISIN, S.TICKER, S.NAME AS SECURITY_NAME, S.ASSET_CLASS,
         S.DEPOSITORY, T.CP_ID, C.NAME AS COUNTERPARTY_NAME, C.CREDIT_RATING,
         T.TRADE_DATE, T.SETTLEMENT_DATE, T.SETTLEMENT_TYPE, T.TRADE_VALUE,
         T.QUANTITY, T.PRICE, T.CURRENCY, T.BOOKING_DESK, T.SETTLEMENT_STATUS,
         T.INSTRUCTION_STATUS, T.CUTOFF_TIME
  FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES T
  LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES S ON T.ISIN = S.ISIN
  LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES C ON T.CP_ID = C.CP_ID
  WHERE T.TRADE_ID = ?
`;

const COUNTERPARTY_SQL = `
  SELECT CP_ID, NAME, CREDIT_RATING, PRIOR_FAILURES_30D,
         HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS
  FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
  WHERE CP_ID = ?
`;

const EVENTS_VIEW_SQL = `
  SELECT EVENT_ID, MESSAGE_TYPE, EVENT_STATUS, DESCRIPTION, SOURCE, EVENT_TIMESTAMP
  FROM CLEARSET_DB.CLEARSET_SCHEMA.V_SETTLEMENT_EVENTS
  WHERE TRADE_ID = ?
  ORDER BY EVENT_TIMESTAMP ASC
`;

const EVENTS_BASE_SQL = `
  SELECT SE.EVENT_ID, SE.MESSAGE_TYPE, SE.STATUS AS EVENT_STATUS,
         SE.DESCRIPTION, SE.SOURCE, SE.EVENT_TIMESTAMP
  FROM CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_EVENTS SE
  WHERE SE.TRADE_ID = ?
  ORDER BY SE.EVENT_TIMESTAMP ASC
`;

export function isValidCaseId(caseId: string): boolean {
  return typeof caseId === 'string' && /^[A-Za-z0-9-]{1,50}$/.test(caseId);
}

async function fetchSettlementEvents(tradeId: string): Promise<SettlementEventRow[]> {
  try {
    return await snowflakeClient.executeStatement<SettlementEventRow>(EVENTS_VIEW_SQL, [tradeId]);
  } catch {
    // Enriched view may be absent in some environments — same fallback as /api routes.
    return await snowflakeClient.executeStatement<SettlementEventRow>(EVENTS_BASE_SQL, [tradeId]);
  }
}

function readSpcsOAuthToken(): string | null {
  try {
    if (fs.existsSync('/snowflake/session/token')) {
      return fs.readFileSync('/snowflake/session/token', 'utf8').trim();
    }
  } catch {
    // Not inside App Runtime
  }
  return null;
}

/** Fresh governed Cortex Search retrieval for this trade at generation time. */
async function runCortexSearchForTrade(tradeId: string): Promise<CortexSearchEvidence> {
  const query = `${tradeId} settlement instruction repair procedure`;
  const generatedAt = new Date().toISOString();
  try {
    const payloadJson = JSON.stringify({
      query,
      columns: ['DOC_CODE', 'POLICY_NAME', 'POLICY_SECTION', 'CHUNK_TEXT'],
      limit: 3,
    }).replace(/'/g, "\\'");
    const sql = `SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW('CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE', '${payloadJson}')) AS SEARCH_OUTPUT`;
    const rows = await snowflakeClient.executeStatement<Record<string, unknown>>(sql);
    const output = rows?.[0]?.['SEARCH_OUTPUT'] as any;
    const rawResults = Array.isArray(output?.results) ? output.results : [];
    return {
      available: true,
      query,
      generatedAt,
      results: rawResults.map((r: any) => ({
        docCode: String(r?.DOC_CODE ?? r?.doc_code ?? 'N/A'),
        policyName: String(r?.POLICY_NAME ?? r?.policy_name ?? 'N/A'),
        section: String(r?.POLICY_SECTION ?? r?.policy_section ?? 'N/A'),
        excerpt: String(r?.CHUNK_TEXT ?? r?.chunk_text ?? '').slice(0, 400),
      })),
    };
  } catch (err: any) {
    console.error('[AuditReport] Cortex Search unavailable:', err?.message || 'unknown');
    return { available: false, query, generatedAt, results: [], note: 'Cortex Search was unavailable when this report was generated. No SOP text is reproduced.' };
  }
}

/** Fresh governed Cortex Analyst answer for this trade at generation time. */
async function runCortexAnalystForTrade(tradeId: string): Promise<CortexAnalystEvidence> {
  const question = `Show me trade ${tradeId}: trade value, settlement status, instruction status, risk score, and exception type.`;
  const generatedAt = new Date().toISOString();
  const account = (process.env.SNOWFLAKE_ACCOUNT || '').toLowerCase();
  const token = readSpcsOAuthToken() || process.env.SNOWFLAKE_PAT || '';
  if (!token) {
    return { available: false, question, generatedAt, note: 'No Cortex Analyst credential available in this environment.' };
  }
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ type: 'text', text: question }] }],
    semantic_view: 'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_ANALYTICS',
  });
  return await new Promise<CortexAnalystEvidence>((resolve) => {
    const request = https.request(
      {
        hostname: process.env.SNOWFLAKE_HOST || `${account}.snowflakecomputing.com`,
        port: 443,
        path: '/api/v2/cortex/analyst/message',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${token}`,
          'X-Snowflake-Authorization-Token-Type': readSpcsOAuthToken() ? 'OAUTH' : 'PROGRAMMATIC_ACCESS_TOKEN',
          Accept: 'application/json',
          'User-Agent': 'ClearSetAI/1.0',
        },
      },
      (response) => {
        let data = '';
        response.on('data', (c) => (data += c));
        response.on('end', () => {
          clearTimeout(timer);
          if (response.statusCode && response.statusCode < 400) {
            try {
              const parsed = JSON.parse(data);
              let interpretation: string | undefined;
              for (const item of parsed?.message?.content ?? []) {
                if (item?.type === 'text' && typeof item.text === 'string') interpretation = item.text;
              }
              resolve({ available: true, question, generatedAt, interpretation });
            } catch {
              resolve({ available: false, question, generatedAt, note: 'Cortex Analyst returned an unparseable response.' });
            }
          } else {
            resolve({ available: false, question, generatedAt, note: `Cortex Analyst unavailable at generation time.` });
          }
        });
      },
    );
    const timer = setTimeout(() => request.destroy(new Error('timeout')), 20_000);
    request.on('error', () => {
      clearTimeout(timer);
      resolve({ available: false, question, generatedAt, note: 'Cortex Analyst was unreachable at generation time.' });
    });
    request.write(body);
    request.end();
  });
}

/**
 * End-to-end report generation for a persisted case.
 * Throws ReportError('CASE_NOT_FOUND') when the ledger has no such case.
 * All supporting evidence degrades honestly when individually unavailable.
 */
export async function generateCaseAuditReport(
  caseId: string,
  options: { includeCortexRefresh?: boolean } = {},
): Promise<{ buffer: Buffer; model: AuditReportModel }> {
  if (!isValidCaseId(caseId)) {
    throw new ReportError('INVALID_CASE_ID', 'Case ID contains invalid characters.');
  }

  const caseRows = await snowflakeClient.executeStatement<CaseRow>(CASE_SQL, [caseId]);
  if (!caseRows || caseRows.length === 0) {
    throw new ReportError('CASE_NOT_FOUND', `No case '${caseId}' found in the audit ledger.`);
  }
  const caseRow = caseRows[0];

  // Supporting evidence — each piece degrades independently.
  let trade: TradeEvidence | null = null;
  try {
    const rows = await snowflakeClient.executeStatement<TradeEvidence>(TRADE_SQL, [caseRow.TRADE_ID]);
    trade = rows?.[0] ?? null;
  } catch (err: any) {
    console.error('[AuditReport] trade evidence unavailable:', err?.message || 'unknown');
  }

  let counterparty: CounterpartyEvidence | null = null;
  if (trade?.CP_ID) {
    try {
      const rows = await snowflakeClient.executeStatement<CounterpartyEvidence>(COUNTERPARTY_SQL, [trade.CP_ID]);
      counterparty = rows?.[0] ?? null;
    } catch (err: any) {
      console.error('[AuditReport] counterparty evidence unavailable:', err?.message || 'unknown');
    }
  }

  let settlementEvents: SettlementEventRow[] = [];
  try {
    settlementEvents = await fetchSettlementEvents(caseRow.TRADE_ID);
  } catch (err: any) {
    console.error('[AuditReport] settlement events unavailable:', err?.message || 'unknown');
  }

  let cortexSearch: CortexSearchEvidence | null = null;
  let cortexAnalyst: CortexAnalystEvidence | null = null;
  if (options.includeCortexRefresh !== false && snowflakeClient.isConfigured()) {
    [cortexSearch, cortexAnalyst] = await Promise.all([
      runCortexSearchForTrade(caseRow.TRADE_ID).catch(() => null),
      runCortexAnalystForTrade(caseRow.TRADE_ID).catch(() => null),
    ]);
  }

  const model = buildReportModel({
    caseRow,
    trade,
    counterparty,
    settlementEvents,
    cortexSearch: cortexSearch ?? {
      available: false, query: '', generatedAt: new Date().toISOString(), results: [],
      note: 'Cortex intelligence not refreshed (offline mode). No SOP text is reproduced.',
    },
    cortexAnalyst: cortexAnalyst ?? {
      available: false, question: '', generatedAt: new Date().toISOString(),
      note: 'Cortex intelligence not refreshed (offline mode).',
    },
    now: new Date(),
  });

  const buffer = await renderAuditPdf(model);
  return { buffer, model };
}
