export type AssetClass = 'Equities' | 'Fixed Income' | 'FX' | 'Derivatives';
export type SettlementType = 'DVP' | 'RVP' | 'FOP';
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'MATCHED' | 'UNMATCHED' | 'CANCELLED';
export type ExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ExceptionStatus = 'OPEN' | 'INVESTIGATING' | 'PENDING_APPROVAL' | 'RESOLVED' | 'ESCALATED';
export type InstructionStatus = 'MATCHED' | 'MISSING' | 'MISMATCHED' | 'PENDING' | 'REJECTED';

export interface Security {
  isin: string;
  cusip: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  depository: 'DTC' | 'Euroclear' | 'Clearstream' | 'Fedwire';
  marketTier: string;
}

export interface Counterparty {
  id: string;
  name: string;
  bic: string;
  lei: string;
  creditRating: 'AAA' | 'AA+' | 'AA' | 'A+' | 'A' | 'BBB+' | 'BBB';
  priorFailures: number;
  totalTradesToday: number;
  historicalFailRate: number;
  avgResolutionTimeHours: number;
  primaryContact: {
    name: string;
    email: string;
    desk: string;
  };
}

export interface SettlementInstruction {
  id: string;
  tradeId: string;
  type: SettlementType;
  custodianBic: string;
  depository: string;
  cashAccount: string;
  securitiesAccount: string;
  status: InstructionStatus;
  lastUpdated: string;
  mismatchDetails?: string;
}

export interface SettlementEvent {
  id: string;
  tradeId: string;
  timestamp: string;
  messageType: 'SWIFT MT541' | 'SWIFT MT543' | 'SWIFT MT548' | 'ISO 20022 sese.023' | 'ISO 20022 sese.024' | 'INTERNAL_ALERT';
  status: string;
  description: string;
  source: 'DEPOSITORY' | 'COUNTERPARTY_FEED' | 'MATCHING_ENGINE' | 'CLEARSET_AGENT';
}

export interface RiskFactor {
  category: string;
  factor: string;
  points: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  iconName: string;
}

export interface RiskScoreBreakdown {
  totalScore: number;
  severity: ExceptionSeverity;
  factors: RiskFactor[];
  summary: string;
  calculatedAt: string;
}

export interface Trade {
  id: string;
  security: Security;
  counterparty: Counterparty;
  tradeDate: string;
  settlementDate: string;
  settlementType: SettlementType;
  tradeValue: number;
  quantity: number;
  price: number;
  currency: string;
  bookingDesk: string;
  traderId: string;
  settlementStatus: SettlementStatus;
  instructionStatus: InstructionStatus;
  cutoffTime: string;
  cutoffMinutesRemaining: number;
}

export interface HistoricalCase {
  caseId: string;
  tradeId: string;
  date: string;
  counterpartyId: string;
  rootCause: string;
  appliedProcedure: string;
  resolutionStrategy: string;
  timeToResolutionHours: number;
  outcome: 'RESOLVED_SUCCESS' | 'ESCALATED' | 'FAILED_SETTLEMENT';
  csdrPenaltyAvoided: number;
  similarityScore: number;
}

export interface PolicyDocument {
  id: string;
  code: string;
  title: string;
  category: 'SOP' | 'ESCALATION' | 'REGULATORY' | 'RISK';
  version: string;
  lastReviewed: string;
  sections: {
    sectionNumber: string;
    sectionTitle: string;
    content: string;
    mandatoryActions: string[];
    escalationThresholds: string[];
  }[];
}

export interface InvestigationStep {
  id: number;
  name: string;
  skillName: string;
  description: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
  outputSummary?: string;
  logs: string[];
}

export interface AIRecommendation {
  primaryAction: string;
  actionSteps: string[];
  applicablePolicyRef: {
    docCode: string;
    section: string;
    title: string;
  };
  rootCause: {
    primary: string;
    contributingFactors: string[];
  };
  similarCasesSummary: {
    totalFound: number;
    correctedInstructionCount: number;
    escalationCount: number;
    failureCount: number;
    avgResolutionTimeHours: number;
  };
  urgency: 'IMMEDIATE' | 'HIGH' | 'ROUTINE';
  csdrPenaltyRiskDaily: number;
}

export interface CaseRecord {
  caseId: string;
  tradeId: string;
  tradeValue: number;
  riskScore: number;
  severity: ExceptionSeverity;
  rootCause: string;
  aiRecommendation: string;
  humanDecision: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'PENDING';
  approvedBy?: string;
  approvedAt?: string;
  executionStatus: 'PENDING' | 'IN_PROGRESS' | 'DISPATCHED' | 'CONFIRMED_SETTLED';
  resolutionOutcome?: string;
  resolutionTimeMinutes?: number;
  createdAt: string;
  auditTrail: {
    timestamp: string;
    action: string;
    actor: 'CLEARSET_AGENT' | 'ANALYST' | 'SYSTEM' | 'COUNTERPARTY' | 'DEPOSITORY';
    details: string;
  }[];
}

export interface ExceptionItem {
  id: string;
  tradeId: string;
  trade: Trade;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  exceptionType: 'Missing Instruction' | 'Cash Discrepancy' | 'Securities Shortage' | 'Counterparty Fail Risk' | 'Cutoff Approaching' | 'Depository Reject';
  riskScore: RiskScoreBreakdown;
  detectedAt: string;
  assignedAnalyst?: string;
  caseId?: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  structuredData?: {
    type: 'risk_breakdown' | 'trade_card' | 'investigation_summary' | 'historical_cases' | 'sop_citation' | 'action_approval' | 'counterparty_intelligence' | 'investigation_launch';
    tradeId?: string;
    riskScore?: number;
    pointsBreakdown?: { label: string; points: number; note: string }[];
    recommendation?: string;
    policyCitation?: { doc: string; section: string; text: string };
    counterparty?: any;
    similarCases?: { total: number; corrected: number; escalated: number; failed: number; avgHours: number };
    tradeSummary?: { id: string; value: string; cp: string; isin: string; cutoff: string };
  };
  suggestedFollowUps?: string[];
}
