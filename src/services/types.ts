import type {
  Trade,
  ExceptionItem,
  ExceptionType,
  SettlementInstruction,
  SettlementEvent,
  HistoricalCase,
  PolicyDocument,
  RiskScoreBreakdown,
  AIRecommendation,
  InvestigationStep,
  CaseRecord,
  Counterparty
} from '../types';

export interface DashboardStats {
  totalTrades: number;
  totalExceptions: number;
  criticalExceptions: number;
  highExceptions: number;
  totalExposureDollars: number;
  criticalExposureDollars: number;
  /** null when the live trade universe cannot be established. */
  settlementRatePercent: number | null;
  /** No resolution-time telemetry exists in the current dataset — surfaced as DATA NOT AVAILABLE. */
  avgTimeToResolveMinutes: number | null;
  /** No penalty ledger exists in the current dataset — surfaced as DATA NOT AVAILABLE. */
  csdrPenaltiesAvoidedToday: number | null;
}

export type DataMode = 'live' | 'local';

/** Context handed to the copilot so answers never invent risk data. */
export interface CopilotChatContext {
  trade: Trade;
  riskScore?: number;
}

export interface ISettlementService {
  getTrades(): Promise<Trade[]>;
  getTradeById(tradeId: string): Promise<Trade | null>;
  getExceptions(): Promise<ExceptionItem[]>;
  getExceptionById(tradeId: string): Promise<ExceptionItem | null>;
  getSettlementInstruction(tradeId: string): Promise<SettlementInstruction | null>;
  getSettlementEvents(tradeId: string): Promise<SettlementEvent[]>;
  getCounterparty(cpId: string): Promise<Counterparty | null>;
  getDashboardMetrics(exceptions: ExceptionItem[], cases: CaseRecord[]): DashboardStats;
  resolveException(tradeId: string, caseRecord: CaseRecord): Promise<boolean>;
}

export interface IRiskService {
  calculateRisk(trade: Trade): RiskScoreBreakdown;
}

export interface IKnowledgeService {
  getAllPolicies(): Promise<PolicyDocument[]>;
  getPolicyByCode(code: string): Promise<PolicyDocument | null>;
  searchPolicies(query: string): Promise<PolicyDocument[]>;
  getApplicableSOP(failureCategory: string): Promise<{ doc: PolicyDocument; section: PolicyDocument['sections'][0] } | null>;
}

export interface ICortexService {
  getInvestigationSteps(): InvestigationStep[];
  executeStep(stepId: number, trade: Trade, dataMode?: DataMode): Promise<{ logs: string[]; summary: string }>;
  generateRecommendation(trade: Trade, exceptionType?: ExceptionType): Promise<AIRecommendation>;
  getHistoricalCases(trade: Trade): Promise<{ cases: HistoricalCase[]; summary: any }>;
  queryCopilot(query: string, context?: CopilotChatContext): Promise<{
    text: string;
    structuredData?: any;
    suggestedFollowUps?: string[];
  }>;
}
