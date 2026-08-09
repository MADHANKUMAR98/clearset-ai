import type { AIRecommendation, InvestigationStep, Trade } from '../types';
import { HISTORICAL_SUMMARY_TRD92831 } from '../data/syntheticData';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';

export const INVESTIGATION_STEPS_TEMPLATE: Omit<InvestigationStep, 'status' | 'logs'>[] = [
  {
    id: 1,
    name: 'Identify Trade & Master Data',
    skillName: 'identify_trade',
    description: 'Query Snowflake TRADES & SECURITIES tables for trade economics, asset class, ISIN, and booking desk.',
  },
  {
    id: 2,
    name: 'Retrieve Settlement State',
    skillName: 'check_settlement_state',
    description: 'Query SETTLEMENT_EVENTS and depository gateway for SWIFT MT541/MT548 matching status.',
  },
  {
    id: 3,
    name: 'Check Settlement Instructions',
    skillName: 'check_instructions',
    description: 'Validate Standing Settlement Instructions (SSI) against depository participant directory.',
  },
  {
    id: 4,
    name: 'Analyze Counterparty History',
    skillName: 'analyze_counterparty',
    description: 'Use Cortex Analyst to query COUNTERPARTIES table for 30-day failure rate and settlement delay metrics.',
  },
  {
    id: 5,
    name: 'Find Similar Historical Cases',
    skillName: 'find_similar_cases',
    description: 'Query HISTORICAL_CASES for institutional operational memory and prior resolution outcomes.',
  },
  {
    id: 6,
    name: 'Retrieve Applicable Procedure',
    skillName: 'retrieve_procedure',
    description: 'Use Cortex Search over Snowflake Knowledge Base for relevant SOP sections and escalation thresholds.',
  },
  {
    id: 7,
    name: 'Assess Settlement Risk',
    skillName: 'assess_settlement_risk',
    description: 'Execute deterministic explainable risk engine to calculate mathematical point allocation (0-100).',
  },
  {
    id: 8,
    name: 'Determine Root Cause',
    skillName: 'determine_root_cause',
    description: 'Synthesize structured evidence to pinpoint primary operational failure point and contributing risk factors.',
  },
  {
    id: 9,
    name: 'Generate Recommendation',
    skillName: 'recommend_resolution',
    description: 'Formulate actionable multi-step resolution plan aligned with SOP guidelines and historical precedents.',
  },
  {
    id: 10,
    name: 'Request Human Approval',
    skillName: 'request_human_approval',
    description: 'Present actionable resolution package with full evidence citations to operations analyst for authorization.',
  },
];

export function generateInitialSteps(): InvestigationStep[] {
  return INVESTIGATION_STEPS_TEMPLATE.map((step) => ({
    ...step,
    status: 'PENDING',
    logs: [],
  }));
}

/**
 * Returns pre-calculated AI recommendation for TRD-92831
 */
export function getAIRecommendation(trade: Trade): AIRecommendation {
  const sop = POLICY_DOCUMENTS[0]; // SOP-OPS-032
  const section = sop.sections[0]; // Section 3.2

  return {
    primaryAction: 'Request corrected settlement instruction and escalate to Settlement Operations desk.',
    actionSteps: [
      '1. Dispatch automated SWIFT MT599 repair notification to CP-192 Equities Clearing Desk.',
      '2. Escalate trade TRD-92831 to Settlement Operations Lead (Tier 1 Priority: Cutoff < 120m, Value > $1M).',
      '3. Continuously monitor depository gateway for DTC Participant 0244 affirmation message.',
      '4. Reassess deterministic settlement risk score immediately upon receiving confirmed SSI.',
    ],
    applicablePolicyRef: {
      docCode: sop.code,
      section: section.sectionNumber,
      title: section.sectionTitle,
    },
    rootCause: {
      primary: 'Missing Standing Settlement Instruction (SSI) for DTC Participant 0244 subaccount.',
      contributingFactors: [
        `Counterparty ${trade.counterparty.name} (${trade.counterparty.id}) has ${trade.counterparty.priorFailures} previous settlement failures in past 30 days.`,
        `DTC Intraday Cutoff approaching in ${Math.floor(trade.cutoffMinutesRemaining / 60)}h ${trade.cutoffMinutesRemaining % 60}m (15:30 EST).`,
        `High-value transaction exposure ($${(trade.tradeValue / 1000000).toFixed(1)}M) exceeding standard operations threshold.`,
        'Historical precedent: 18 similar cases required early escalation to avoid end-of-day depository reject.',
      ],
    },
    similarCasesSummary: HISTORICAL_SUMMARY_TRD92831,
    urgency: 'IMMEDIATE',
    csdrPenaltyRiskDaily: 1566.67,
  };
}

/**
 * Step log generator for realistic streaming simulation
 */
export function getStepLogs(stepId: number, trade: Trade): { logs: string[]; summary: string } {
  switch (stepId) {
    case 1:
      return {
        logs: [
          `[CORTEX_ANALYST] SELECT * FROM TRADES JOIN SECURITIES ON TRADES.ISIN = SECURITIES.ISIN WHERE TRADE_ID = '${trade.id}';`,
          `[DATA_ENGINE] Identified Trade: ${trade.id} | Asset: ${trade.security.name} (${trade.security.ticker}) | ISIN: ${trade.security.isin}`,
          `[DATA_ENGINE] Economics: ${trade.quantity.toLocaleString()} units @ $${trade.price.toFixed(2)} = $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.currency} | Desk: ${trade.bookingDesk}`,
        ],
        summary: `Trade ${trade.id} verified: $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.security.ticker} (${trade.settlementType}) booked for same-day value.`,
      };
    case 2:
      return {
        logs: [
          `[GATEWAY] Querying DTC depository matching status for Trade ${trade.id}...`,
          `[GATEWAY] Received SWIFT MT548 response: Status 'UNCONFIRMED_PENDING_MATCH'`,
          `[SETTLEMENT_CORE] Cutoff deadline: ${trade.cutoffTime} (${trade.cutoffMinutesRemaining} minutes remaining). Status: PENDING`,
        ],
        summary: `Settlement state: Unmatched at DTC. Cutoff deadline in ${trade.cutoffMinutesRemaining} minutes.`,
      };
    case 3:
      return {
        logs: [
          `[SSI_SERVICE] Querying Standing Settlement Instructions repository for ${trade.counterparty.id}...`,
          `[SSI_SERVICE] Result: No linked depository subaccount mapped for DTC Participant 0244 on market tier ${trade.security.marketTier}.`,
          `[VALIDATION] Status: MISSING_INSTRUCTION (Flag raised).`,
        ],
        summary: 'Standing Settlement Instruction (SSI) is MISSING for DTC Participant 0244.',
      };
    case 4:
      return {
        logs: [
          `[CORTEX_ANALYST] SELECT * FROM COUNTERPARTIES WHERE CP_ID = '${trade.counterparty.id}';`,
          `[CP_PROFILE] Name: ${trade.counterparty.name} | Credit Rating: ${trade.counterparty.creditRating}`,
          `[CP_PROFILE] Past 30-day failure count: ${trade.counterparty.priorFailures} fails | Fail rate: ${trade.counterparty.historicalFailRate}% | Avg delay: ${trade.counterparty.avgResolutionTimeHours}h`,
          `[RISK_ASSESSMENT] Counterparty classified as High-Friction Operator under POL-RSK-008.`,
        ],
        summary: `${trade.counterparty.name} exhibits ${trade.counterparty.priorFailures} recent fails (8.4% fail rate).`,
      };
    case 5:
      return {
        logs: [
          `[CORTEX_SEARCH] Vector search across HISTORICAL_CASES with embedding for 'Missing SSI + US Equities + ${trade.counterparty.name}'...`,
          `[HISTORY_MATCH] Found 18 similar historical cases (Average similarity: 93.4%).`,
          `[RESOLUTION_ANALYSIS] Breakdown: 12 Corrected SSI (66.7%), 4 Escalated (22.2%), 2 Failed (11.1%). Avg resolution time: 3.8 hours.`,
        ],
        summary: 'Matched 18 similar historical cases. 88.9% resolved successfully via proactive repair.',
      };
    case 6:
      return {
        logs: [
          `[CORTEX_SEARCH] Querying Snowflake Knowledge Base for 'Missing settlement instruction close to cutoff threshold'...`,
          `[KB_RETRIEVAL] Matched Document: SOP-OPS-032 (Settlement Exception SOP), Section 3.2: 'Missing Settlement Instructions & Expedited SSI Repair'.`,
          `[KB_POLICY] Mandatory Action: Request expedited repair via SWIFT/ISO 20022 and trigger Tier 1 supervisor escalation.`,
        ],
        summary: 'Retrieved SOP-OPS-032 Section 3.2: Mandatory expedited repair and desk escalation required.',
      };
    case 7:
      return {
        logs: [
          `[RISK_ENGINE] Running deterministic formula for Trade ${trade.id}...`,
          `[RISK_ENGINE] Factors: Missing SSI (+25) | Cutoff < 120m (+25) | Value > $2M (+20) | CP Fails > 5 (+15) | History (+6)`,
          `[RISK_ENGINE] Total Score: 91/100 -> Severity: CRITICAL`,
        ],
        summary: 'Deterministic Risk Score: 91/100 (CRITICAL). 5 explainable risk dimensions identified.',
      };
    case 8:
      return {
        logs: [
          `[ROOT_CAUSE_ANALYZER] Synthesizing findings across structured data, depository status, and policy guidance...`,
          `[ROOT_CAUSE_ANALYZER] Primary: Missing SSI for DTC Participant 0244 subaccount.`,
          `[ROOT_CAUSE_ANALYZER] Secondary drivers: Proximity to 15:30 EST cutoff, high counterparty fail history, and $2.4M exposure.`,
        ],
        summary: 'Root Cause: Missing SSI combined with critical 102-minute cutoff proximity.',
      };
    case 9:
      return {
        logs: [
          `[RECOMMENDER] Formulating action plan aligned with SOP-OPS-032 §3.2 and historical success playbook...`,
          `[RECOMMENDER] Plan: 1. Dispatch SWIFT MT599 repair -> 2. Escalate to Ops Lead -> 3. Monitor DTC queue -> 4. Recalculate risk.`,
          `[RECOMMENDER] Projected CSDR Penalty Avoided: $1,566.67/day.`,
        ],
        summary: 'Generated 4-step resolution plan. Ready for human authorization.',
      };
    case 10:
      return {
        logs: [
          `[HUMAN_IN_THE_LOOP] Preparing Human Approval package with verified evidence citations and action buttons...`,
          `[HUMAN_IN_THE_LOOP] Awaiting analyst authorization. Agent will execute dispatch upon confirmation.`,
        ],
        summary: 'Human-in-the-loop approval package generated. Awaiting analyst sign-off.',
      };
    default:
      return { logs: [], summary: '' };
  }
}
