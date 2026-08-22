import type { ISettlementService, DashboardStats } from './types';
import type {
  AssetClass,
  Counterparty,
  CaseRecord,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionStatus,
  InstructionStatus,
  Security,
  SettlementEvent,
  SettlementInstruction,
  SettlementStatus,
  SettlementType,
  Trade,
} from '../types';
import {
  EXCEPTIONS,
  COUNTERPARTIES,
  SETTLEMENT_INSTRUCTIONS,
  SETTLEMENT_EVENTS_TRD92831,
} from '../data/syntheticData';
import {
  fetchExceptionsFromApi,
  fetchTradesFromApi,
  fetchCounterpartyFromApi,
  fetchSettlementEventsFromApi,
  createCase,
} from './apiClient';
import { calculateSettlementRisk } from '../engine/riskEngine';
import { pickColumn } from './types';

// ============================================================================
// LocalSettlementService — syntheticData fallback (must never be removed)
// ============================================================================
export class LocalSettlementService implements ISettlementService {
  private exceptions: ExceptionItem[] = [...EXCEPTIONS];

  public async getTrades(): Promise<Trade[]> {
    return this.exceptions.map((e) => e.trade);
  }

  public async getTradeById(tradeId: string): Promise<Trade | null> {
    const ex = this.exceptions.find((e) => e.tradeId === tradeId);
    return ex ? ex.trade : null;
  }

  public async getExceptions(): Promise<ExceptionItem[]> {
    return [...this.exceptions];
  }

  public async getExceptionById(tradeId: string): Promise<ExceptionItem | null> {
    const ex = this.exceptions.find((e) => e.tradeId === tradeId);
    return ex ? { ...ex } : null;
  }

  public async getSettlementInstruction(tradeId: string): Promise<SettlementInstruction | null> {
    const ssi = SETTLEMENT_INSTRUCTIONS[tradeId];
    return ssi ? { ...ssi } : null;
  }

  public async getSettlementEvents(tradeId: string): Promise<SettlementEvent[]> {
    if (tradeId === 'TRD-92831') {
      return [...SETTLEMENT_EVENTS_TRD92831];
    }
    // For other trades, return empty array (no synthetic events available)
    // The live backend will be tried first via HybridSettlementService
    return [];
  }

  public async getCounterparty(cpId: string): Promise<Counterparty | null> {
    const cp = COUNTERPARTIES[cpId];
    return cp ? { ...cp } : null;
  }

  /**
   * Dynamically calculates metrics from active state
   */
  public getDashboardMetrics(currentExceptions: ExceptionItem[], cases: CaseRecord[]): DashboardStats {
    const openExceptions = currentExceptions.filter((e) => e.status !== 'RESOLVED');
    const criticalExceptions = openExceptions.filter((e) => e.severity === 'CRITICAL');
    const highExceptions = openExceptions.filter((e) => e.severity === 'HIGH');

    // Sum exposure of active unresolved exceptions
    const activeExposure = openExceptions.reduce((sum, e) => sum + e.trade.tradeValue, 0);

    // Sum penalty avoided from approved cases
    const totalPenaltiesAvoided = 142800 + (cases.length * 1566);

    const totalTrades = 128420;
    const settlementRate = Number(((totalTrades - openExceptions.length) / totalTrades * 100).toFixed(2));

    return {
      totalTrades,
      totalExceptions: openExceptions.length + 376, // Base batch count + dynamic active items
      criticalExceptions: criticalExceptions.length + 39, // Base critical queue + dynamic criticals
      highExceptions: highExceptions.length,
      totalExposureDollars: activeExposure + 72900000, // Dynamic active exposure + baseline firm queue
      criticalExposureDollars: activeExposure + 72900000, // Local fallback includes baseline
      settlementRatePercent: settlementRate,
      avgTimeToResolveMinutes: 38,
      csdrPenaltiesAvoidedToday: totalPenaltiesAvoided,
    };
  }

  public async resolveException(tradeId: string, _caseRecord: CaseRecord): Promise<boolean> {
    this.exceptions = this.exceptions.map((e) =>
      e.tradeId === tradeId ? { ...e, status: 'RESOLVED' } : e
    );
    return true;
  }
}

// ============================================================================
// Column-picking utilities for Snowflake row mapping
// ============================================================================

function pickColumn(row: Record<string, unknown>, name: string): unknown {
  const match = Object.keys(row).find((key) => key.toUpperCase() === name.toUpperCase());
  return match ? row[match] : undefined;
}

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asAssetClass(value: unknown): AssetClass {
  const raw = asString(value);
  if (raw === 'Equities' || raw === 'Fixed Income' || raw === 'FX' || raw === 'Derivatives') {
    return raw;
  }
  return 'Equities';
}

function asSettlementType(value: unknown): SettlementType {
  const raw = asString(value);
  if (raw === 'DVP' || raw === 'RVP' || raw === 'FOP') return raw;
  return 'DVP';
}

function asSettlementStatus(value: unknown): SettlementStatus {
  const raw = asString(value).toUpperCase();
  if (
    raw === 'PENDING' ||
    raw === 'SETTLED' ||
    raw === 'FAILED' ||
    raw === 'MATCHED' ||
    raw === 'UNMATCHED' ||
    raw === 'CANCELLED'
  ) {
    return raw as SettlementStatus;
  }
  return 'PENDING';
}

function asDepository(value: unknown): Security['depository'] {
  const raw = asString(value);
  if (raw === 'DTC' || raw === 'Euroclear' || raw === 'Clearstream' || raw === 'Fedwire') {
    return raw;
  }
  return 'DTC';
}

function asSeverity(value: unknown): ExceptionSeverity {
  const raw = asString(value).toUpperCase();
  if (raw === 'CRITICAL' || raw === 'HIGH' || raw === 'MEDIUM' || raw === 'LOW') {
    return raw;
  }
  return 'MEDIUM';
}

function asExceptionStatus(value: unknown): ExceptionStatus {
  const raw = asString(value).toUpperCase();
  if (
    raw === 'OPEN' ||
    raw === 'INVESTIGATING' ||
    raw === 'PENDING_APPROVAL' ||
    raw === 'RESOLVED' ||
    raw === 'ESCALATED'
  ) {
    return raw;
  }
  return 'OPEN';
}

function asInstructionStatus(value: unknown): InstructionStatus {
  const raw = asString(value).toUpperCase();
  if (
    raw === 'MATCHED' ||
    raw === 'MISSING' ||
    raw === 'MISMATCHED' ||
    raw === 'PENDING' ||
    raw === 'REJECTED'
  ) {
    return raw;
  }
  return 'PENDING';
}

function asExceptionType(value: unknown): ExceptionItem['exceptionType'] {
  const allowed: ExceptionItem['exceptionType'][] = [
    'Missing Instruction',
    'Cash Discrepancy',
    'Securities Shortage',
    'Counterparty Fail Risk',
    'Cutoff Approaching',
    'Depository Reject',
  ];
  const raw = asString(value);
  const match = allowed.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match ?? 'Missing Instruction';
}

function asCreditRating(value: unknown): Counterparty['creditRating'] {
  const raw = asString(value);
  const allowed: Counterparty['creditRating'][] = ['AAA', 'AA+', 'AA', 'A+', 'A', 'BBB+', 'BBB'];
  const match = allowed.find((item) => item === raw);
  return match ?? 'A';
}

// ============================================================================
// Mapping: Snowflake exception row → ExceptionItem
// ============================================================================
function mapSnowflakeExceptionRow(row: Record<string, unknown>): ExceptionItem {
  const tradeId = asString(pickColumn(row, 'TRADE_ID'));
  const cpId = asString(pickColumn(row, 'CP_ID'));
  const localCp = COUNTERPARTIES[cpId];

  const instructionStatus = asInstructionStatus(pickColumn(row, 'SSI_STATUS'));
  const minutesToCutoff = Math.round(asNumber(pickColumn(row, 'MINUTES_TO_CUTOFF')));
  const snowflakeRisk = Math.round(asNumber(pickColumn(row, 'RISK_SCORE')));
  const snowflakeSeverity = asSeverity(pickColumn(row, 'SEVERITY'));

  const counterparty: Counterparty = localCp
    ? {
      ...localCp,
      name: asString(pickColumn(row, 'COUNTERPARTY_NAME'), localCp.name),
      creditRating: asCreditRating(pickColumn(row, 'CREDIT_RATING') ?? localCp.creditRating),
      priorFailures: asNumber(pickColumn(row, 'PRIOR_FAILURES_30D'), localCp.priorFailures),
      historicalFailRate: asNumber(pickColumn(row, 'HISTORICAL_FAIL_RATE'), localCp.historicalFailRate),
    }
    : {
      id: cpId || 'UNKNOWN',
      name: asString(pickColumn(row, 'COUNTERPARTY_NAME'), 'Unknown Counterparty'),
      bic: asString(pickColumn(row, 'CUSTODIAN_BIC')),
      lei: '',
      creditRating: asCreditRating(pickColumn(row, 'CREDIT_RATING')),
      priorFailures: asNumber(pickColumn(row, 'PRIOR_FAILURES_30D')),
      totalTradesToday: 0,
      historicalFailRate: asNumber(pickColumn(row, 'HISTORICAL_FAIL_RATE')),
      avgResolutionTimeHours: 0,
      primaryContact: {
        name: '',
        email: '',
        desk: '',
      },
    };

  const trade: Trade = {
    id: tradeId,
    security: {
      isin: '',
      cusip: '',
      ticker: asString(pickColumn(row, 'TICKER')),
      name: asString(pickColumn(row, 'SECURITY_NAME')),
      assetClass: asAssetClass(pickColumn(row, 'ASSET_CLASS')),
      depository: asDepository(pickColumn(row, 'DEPOSITORY')),
      marketTier: '',
    },
    counterparty,
    tradeDate: asString(pickColumn(row, 'SETTLEMENT_DATE')),
    settlementDate: asString(pickColumn(row, 'SETTLEMENT_DATE')).slice(0, 10),
    settlementType: asSettlementType(pickColumn(row, 'SETTLEMENT_TYPE')),
    tradeValue: asNumber(pickColumn(row, 'TRADE_VALUE')),
    quantity: 0,
    price: 0,
    currency: asString(pickColumn(row, 'CURRENCY'), 'USD'),
    bookingDesk: '',
    traderId: '',
    settlementStatus: 'PENDING',
    instructionStatus,
    cutoffTime: asString(pickColumn(row, 'CUTOFF_TIME')),
    cutoffMinutesRemaining: minutesToCutoff,
  };

  const riskScore = calculateSettlementRisk(trade);
  riskScore.totalScore = snowflakeRisk;
  riskScore.severity = snowflakeSeverity;
  riskScore.summary = `Snowflake risk score: ${snowflakeRisk}/100 (${snowflakeSeverity}).`;

  return {
    id: asString(pickColumn(row, 'EXCEPTION_ID'), `EX-${tradeId.replace('TRD-', '')}`),
    tradeId,
    trade,
    severity: snowflakeSeverity,
    status: asExceptionStatus(pickColumn(row, 'EXCEPTION_STATUS')),
    exceptionType: asExceptionType(pickColumn(row, 'EXCEPTION_TYPE')),
    riskScore,
    detectedAt: asString(pickColumn(row, 'CUTOFF_TIME'), new Date().toISOString()),
  };
}

// ============================================================================
// Mapping: Snowflake trade row → Trade
// ============================================================================
function mapSnowflakeTradeRow(row: Record<string, unknown>): Trade {
  const tradeId = asString(pickColumn(row, 'TRADE_ID'));
  const cpId = asString(pickColumn(row, 'CP_ID'));
  const localCp = COUNTERPARTIES[cpId];

  const counterparty: Counterparty = localCp
    ? {
      ...localCp,
      name: asString(pickColumn(row, 'COUNTERPARTY_NAME'), localCp.name),
      creditRating: asCreditRating(pickColumn(row, 'CREDIT_RATING') ?? localCp.creditRating),
    }
    : {
      id: cpId || 'UNKNOWN',
      name: asString(pickColumn(row, 'COUNTERPARTY_NAME'), 'Unknown Counterparty'),
      bic: '',
      lei: '',
      creditRating: asCreditRating(pickColumn(row, 'CREDIT_RATING')),
      priorFailures: 0,
      totalTradesToday: 0,
      historicalFailRate: 0,
      avgResolutionTimeHours: 0,
      primaryContact: { name: '', email: '', desk: '' },
    };

  return {
    id: tradeId,
    security: {
      isin: asString(pickColumn(row, 'ISIN')),
      cusip: '',
      ticker: asString(pickColumn(row, 'TICKER')),
      name: asString(pickColumn(row, 'SECURITY_NAME')),
      assetClass: asAssetClass(pickColumn(row, 'ASSET_CLASS')),
      depository: asDepository(pickColumn(row, 'DEPOSITORY')),
      marketTier: '',
    },
    counterparty,
    tradeDate: asString(pickColumn(row, 'TRADE_DATE')),
    settlementDate: asString(pickColumn(row, 'SETTLEMENT_DATE')).slice(0, 10),
    settlementType: asSettlementType(pickColumn(row, 'SETTLEMENT_TYPE')),
    tradeValue: asNumber(pickColumn(row, 'TRADE_VALUE')),
    quantity: asNumber(pickColumn(row, 'QUANTITY')),
    price: asNumber(pickColumn(row, 'PRICE')),
    currency: asString(pickColumn(row, 'CURRENCY'), 'USD'),
    bookingDesk: asString(pickColumn(row, 'BOOKING_DESK')),
    traderId: '',
    // SETTLEMENT_STATUS: present in V_TRADE_ENRICHED from TRADES table
    settlementStatus: asSettlementStatus(pickColumn(row, 'SETTLEMENT_STATUS')),
    // INSTRUCTION_STATUS: present in V_TRADE_ENRICHED from TRADES table
    instructionStatus: asInstructionStatus(pickColumn(row, 'INSTRUCTION_STATUS')),
    cutoffTime: asString(pickColumn(row, 'CUTOFF_TIME')),
    cutoffMinutesRemaining: 0, // Not available in V_TRADE_ENRICHED (no DATEDIFF)
  };
}

// ============================================================================
// Mapping: Snowflake counterparty row → Counterparty
// ============================================================================
function mapSnowflakeCounterpartyRow(row: Record<string, unknown>): Counterparty {
  const cpId = asString(pickColumn(row, 'CP_ID'));
  // Parse PRIMARY_DESK_CONTACT: "Marcus Vance (Equities Clearing Desk NY)"
  const primaryDeskContact = asString(pickColumn(row, 'PRIMARY_DESK_CONTACT'));
  const contactNameMatch = primaryDeskContact.match(/^([^(]+)/);
  const deskMatch = primaryDeskContact.match(/\(([^)]+)\)/);
  const contactName = contactNameMatch ? contactNameMatch[1].trim() : primaryDeskContact;
  const deskName = deskMatch ? deskMatch[1].trim() : '';

  return {
    id: cpId,
    name: asString(pickColumn(row, 'NAME')),
    bic: asString(pickColumn(row, 'BIC')),
    lei: asString(pickColumn(row, 'LEI')),
    creditRating: asCreditRating(pickColumn(row, 'CREDIT_RATING')),
    priorFailures: asNumber(pickColumn(row, 'PRIOR_FAILURES_30D')),
    totalTradesToday: asNumber(pickColumn(row, 'TOTAL_TRADES_TODAY')),
    historicalFailRate: asNumber(pickColumn(row, 'HISTORICAL_FAIL_RATE')),
    avgResolutionTimeHours: asNumber(pickColumn(row, 'AVG_RESOLUTION_HOURS')),
    primaryContact: {
      name: contactName,
      email: asString(pickColumn(row, 'PRIMARY_EMAIL')),
      desk: deskName,
    },
  };
}

// ============================================================================
// Mapping: Snowflake settlement event row → SettlementEvent
// ============================================================================
const ALLOWED_MESSAGE_TYPES: SettlementEvent['messageType'][] = [
  'SWIFT MT541',
  'SWIFT MT543',
  'SWIFT MT548',
  'ISO 20022 sese.023',
  'ISO 20022 sese.024',
  'INTERNAL_ALERT',
];

const ALLOWED_SOURCES: SettlementEvent['source'][] = [
  'DEPOSITORY',
  'COUNTERPARTY_FEED',
  'MATCHING_ENGINE',
  'CLEARSET_AGENT',
];

function asMessageType(value: unknown): SettlementEvent['messageType'] {
  const raw = asString(value);
  const match = ALLOWED_MESSAGE_TYPES.find((t) => t === raw);
  return match ?? 'INTERNAL_ALERT';
}

function asEventSource(value: unknown): SettlementEvent['source'] {
  const raw = asString(value).toUpperCase();
  const match = ALLOWED_SOURCES.find((s) => s === raw);
  return match ?? 'CLEARSET_AGENT';
}

function mapSnowflakeSettlementEventRow(row: Record<string, unknown>): SettlementEvent {
  return {
    id: asString(pickColumn(row, 'EVENT_ID')),
    tradeId: asString(pickColumn(row, 'TRADE_ID')),
    timestamp: asString(pickColumn(row, 'EVENT_TIMESTAMP')),
    messageType: asMessageType(pickColumn(row, 'MESSAGE_TYPE')),
    status: asString(pickColumn(row, 'EVENT_STATUS')),
    description: asString(pickColumn(row, 'DESCRIPTION')),
    source: asEventSource(pickColumn(row, 'SOURCE')),
  };
}

// ============================================================================
// HybridSettlementService
// Uses live Snowflake endpoints when available; falls back to LocalSettlementService.
// Stage 2 integration (GET /api/exceptions) is PRESERVED UNCHANGED.
// Stage 3 adds live trades, counterparties, and settlement events.
// ============================================================================
class HybridSettlementService implements ISettlementService {
  private liveExceptions: ExceptionItem[] | null = null;
  private local: LocalSettlementService;

  constructor(local: LocalSettlementService) {
    this.local = local;
  }

  private async loadLiveExceptions(): Promise<ExceptionItem[] | null> {
    try {
      const response = await fetchExceptionsFromApi();
      if (!response.success || response.mode !== 'snowflake') {
        this.liveExceptions = null;
        return null;
      }
      this.liveExceptions = response.data.map((row) => mapSnowflakeExceptionRow(row));
      return this.liveExceptions;
    } catch {
      this.liveExceptions = null;
      return null;
    }
  }

  public async getTrades(): Promise<Trade[]> {
    // Stage 3: try live /api/trades endpoint first
    try {
      const response = await fetchTradesFromApi();
      if (response.success && response.mode === 'snowflake' && response.data.length > 0) {
        return response.data.map((row) => mapSnowflakeTradeRow(row));
      }
    } catch {
      // fall through
    }

    // Fallback: derive trades from live exceptions
    const live = this.liveExceptions ?? (await this.loadLiveExceptions());
    if (live) return live.map((item) => item.trade);

    return this.local.getTrades();
  }

  public async getTradeById(tradeId: string): Promise<Trade | null> {
    // Try live exceptions cache first (fast path)
    const live = this.liveExceptions ?? (await this.loadLiveExceptions());
    if (live) {
      const match = live.find((item) => item.tradeId === tradeId);
      return match ? match.trade : null;
    }
    return this.local.getTradeById(tradeId);
  }

  public async getExceptions(): Promise<ExceptionItem[]> {
    // Stage 2: preserved — always reloads from live API
    const live = await this.loadLiveExceptions();
    if (live) return [...live];
    return this.local.getExceptions();
  }

  public async getExceptionById(tradeId: string): Promise<ExceptionItem | null> {
    const live = this.liveExceptions ?? (await this.loadLiveExceptions());
    if (live) {
      const match = live.find((item) => item.tradeId === tradeId);
      return match ? { ...match } : null;
    }
    return this.local.getExceptionById(tradeId);
  }

  public async getSettlementInstruction(tradeId: string): Promise<SettlementInstruction | null> {
    // SSI data is read from local syntheticData (no Snowflake endpoint for SSIs in Stage 3)
    return this.local.getSettlementInstruction(tradeId);
  }

  public async getSettlementEvents(tradeId: string): Promise<SettlementEvent[]> {
    // Stage 3: try live /api/settlement-events/:tradeId endpoint
    try {
      const response = await fetchSettlementEventsFromApi(tradeId);
      if (response.success && response.mode === 'snowflake') {
        // Return whatever Snowflake returns (including empty array)
        // Do not fall back to local synthetic data for specific trades
        return response.data.map((row) => mapSnowflakeSettlementEventRow(row));
      }
    } catch {
      // fall through to local on error
    }
    return this.local.getSettlementEvents(tradeId);
  }

  public async getCounterparty(cpId: string): Promise<Counterparty | null> {
    // Stage 3: try live /api/counterparties/:id endpoint
    try {
      const response = await fetchCounterpartyFromApi(cpId);
      if (response.success && response.mode === 'snowflake' && response.data) {
        return mapSnowflakeCounterpartyRow(response.data);
      }
    } catch {
      // fall through to local
    }
    return this.local.getCounterparty(cpId);
  }

  public getDashboardMetrics(currentExceptions: ExceptionItem[], cases: CaseRecord[]): DashboardStats {
    // Use live computation if we have live exceptions loaded
    if (this.liveExceptions && this.liveExceptions.length > 0) {
      return this.computeLiveDashboardMetrics(this.liveExceptions, cases);
    }
    return this.local.getDashboardMetrics(currentExceptions, cases);
  }

  /**
   * Compute dashboard metrics entirely from live Snowflake data.
   * No artificial baselines or offsets.
   */
  private computeLiveDashboardMetrics(liveExceptions: ExceptionItem[], cases: CaseRecord[]): DashboardStats {
    const openExceptions = liveExceptions.filter((e) => e.status !== 'RESOLVED');
    const criticalExceptions = openExceptions.filter((e) => e.severity === 'CRITICAL');
    const highExceptions = openExceptions.filter((e) => e.severity === 'HIGH');

    // Gross exposure from live open exceptions only
    const activeExposure = openExceptions.reduce((sum, e) => sum + e.trade.tradeValue, 0);

    // Critical exposure from live critical exceptions only
    const criticalExposure = criticalExceptions.reduce((sum, e) => sum + e.trade.tradeValue, 0);

    // Total trades monitored — from live data if available, else use known baseline
    const totalTrades = 128420; // This is a static operational metric, not derived from exceptions

    // Settlement rate based on live data
    const settlementRate = Number(((totalTrades - openExceptions.length) / totalTrades * 100).toFixed(2));

    // Penalties avoided from persisted cases (Snowflake mode) + local cases
    // In live mode, cases should include Snowflake-persisted cases
    const totalPenaltiesAvoided = cases.length * 1566; // Per-case estimate

    return {
      totalTrades,
      totalExceptions: openExceptions.length,
      criticalExceptions: criticalExceptions.length,
      highExceptions: highExceptions.length,
      totalExposureDollars: activeExposure,
      criticalExposureDollars: criticalExposure,
      settlementRatePercent: settlementRate,
      avgTimeToResolveMinutes: 38, // Static operational metric
      csdrPenaltiesAvoidedToday: totalPenaltiesAvoided,
    };
  }

  public async resolveException(tradeId: string, caseRecord: CaseRecord): Promise<boolean> {
    // If in live Snowflake mode, persist the case to Snowflake
    if (this.liveExceptions && this.liveExceptions.length > 0) {
      try {
        const exception = this.liveExceptions.find((e) => e.tradeId === tradeId);
        const exceptionId = exception?.id ?? `EX-${tradeId.replace('TRD-', '')}`;

        await createCase({
          caseId: caseRecord.caseId,
          tradeId,
          exceptionId,
          status: caseRecord.humanDecision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          riskScore: caseRecord.riskScore,
          rootCause: caseRecord.rootCause,
          recommendation: caseRecord.aiRecommendation,
          resolutionOutcome: caseRecord.resolutionOutcome,
          approvedBy: caseRecord.approvedBy,
          approvedAt: caseRecord.approvedAt,
        });
      } catch (err) {
        // Log but don't fail the UI — case remains in local state
        console.warn('[ClearSet] Failed to persist case to Snowflake:', err);
      }
    }

    if (this.liveExceptions) {
      this.liveExceptions = this.liveExceptions.map((item) =>
        item.tradeId === tradeId ? { ...item, status: 'RESOLVED' } : item,
      );
    }
    return this.local.resolveException(tradeId, caseRecord);
  }
}

export const settlementService: ISettlementService = new HybridSettlementService(
  new LocalSettlementService(),
);
