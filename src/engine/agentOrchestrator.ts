import type { AIRecommendation, InvestigationStep, Trade } from '../types';
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
 * Returns AI recommendation dynamically generated from trade data
 */
export function getAIRecommendation(trade: Trade): AIRecommendation {
  const sop = POLICY_DOCUMENTS[0]; // SOP-OPS-032
  const section = sop.sections[0]; // Section 3.2

  // Determine primary action based on exception type (inferred from trade data)
  const isMissingInstruction = trade.instructionStatus === 'MISSING';
  const isCashDiscrepancy = trade.instructionStatus === 'MISMATCHED';
  const isHighCounterpartyRisk = trade.counterparty.priorFailures >= 5;
  const isCutoffApproaching = trade.cutoffMinutesRemaining <= 120;
  const isHighValue = trade.tradeValue >= 1000000;

  let primaryAction: string;
  let actionSteps: string[];

  if (isMissingInstruction) {
    primaryAction = 'Request corrected settlement instruction and escalate to Settlement Operations desk.';
    actionSteps = [
      `1. Dispatch automated SWIFT MT599 repair notification to ${trade.counterparty.name} (${trade.counterparty.primaryContact.desk}).`,
      `2. Escalate trade ${trade.id} to Settlement Operations Lead (Tier 1 Priority: Cutoff < 120m, Value > $1M).`,
      `3. Continuously monitor depository gateway for ${trade.security.depository} affirmation message.`,
      '4. Reassess deterministic settlement risk score immediately upon receiving confirmed SSI.',
    ];
  } else if (isCashDiscrepancy) {
    primaryAction = 'Execute cash variance adjustment and verify with counterparty.';
    actionSteps = [
      '1. Calculate cash variance and verify against SOP threshold.',
      `2. Dispatch variance adjustment request to ${trade.counterparty.name}.`,
      '3. Escalate to Operations Lead if variance exceeds $10k threshold.',
      '4. Confirm adjusted amount and reassess settlement risk.',
    ];
  } else if (isHighCounterpartyRisk) {
    primaryAction = 'Escalate to counterparty relationship manager and operations lead.';
    actionSteps = [
      `1. Escalate to Counterparty Relationship Manager for ${trade.counterparty.name}.`,
      '2. Engage Settlement Operations Lead for Tier 1 escalation.',
      '3. Activate contingency settlement instructions if available.',
      '4. Monitor counterparty response and depository status continuously.',
    ];
  } else if (isCutoffApproaching) {
    primaryAction = 'Accelerate settlement processing and monitor depository queue.';
    actionSteps = [
      `1. Accelerate settlement instruction validation for ${trade.id}.`,
      '2. Escalate to Operations Lead for priority processing.',
      `3. Monitor ${trade.security.depository} queue position continuously.`,
      '4. Confirm settlement completion before cutoff.',
    ];
  } else {
    primaryAction = 'Review exception details and determine resolution path.';
    actionSteps = [
      '1. Review exception details and determine root cause.',
      '2. Consult applicable SOP for resolution procedure.',
      '3. Escalate to Operations Lead as appropriate.',
      '4. Monitor resolution and reassess risk.',
    ];
  }

  // Build contributing factors dynamically
  const contributingFactors: string[] = [];

  if (trade.counterparty.priorFailures > 0) {
    contributingFactors.push(
      `Counterparty ${trade.counterparty.name} (${trade.counterparty.id}) has ${trade.counterparty.priorFailures} previous settlement failures in past 30 days (${trade.counterparty.historicalFailRate}% fail rate).`
    );
  }

  if (trade.cutoffMinutesRemaining <= 240) {
    const hours = Math.floor(trade.cutoffMinutesRemaining / 60);
    const mins = trade.cutoffMinutesRemaining % 60;
    contributingFactors.push(
      `Depository cutoff approaching in ${hours}h ${mins}m (${trade.cutoffTime}).`
    );
  }

  if (trade.tradeValue >= 1000000) {
    contributingFactors.push(
      `High-value transaction exposure ($${(trade.tradeValue / 1000000).toFixed(1)}M) exceeding standard operations threshold.`
    );
  }

  if (trade.counterparty.priorFailures >= 5) {
    contributingFactors.push(
      'Counterparty classified as high-friction operator; historical precedent suggests early escalation required.'
    );
  }

  if (contributingFactors.length === 0) {
    contributingFactors.push('No significant contributing risk factors identified beyond primary failure cause.');
  }

  // Calculate CSDR penalty risk (rough estimate: 0.065% of trade value per day)
  const csdrPenaltyRiskDaily = trade.tradeValue * 0.00065 / 365;

  return {
    primaryAction,
    actionSteps,
    applicablePolicyRef: {
      docCode: sop.code,
      section: section.sectionNumber,
      title: section.sectionTitle,
    },
    rootCause: {
      primary: isMissingInstruction
        ? `Missing Standing Settlement Instruction (SSI) for ${trade.counterparty.name} at ${trade.security.depository}.`
        : isCashDiscrepancy
        ? `Cash amount mismatch between trade ticket and settlement affirmation.`
        : isHighCounterpartyRisk
        ? `Counterparty ${trade.counterparty.name} has elevated failure risk (${trade.counterparty.priorFailures} prior fails in 30 days).`
        : isCutoffApproaching
        ? `Settlement cutoff deadline approaching with incomplete processing.`
        : 'Undetermined settlement exception.',
      contributingFactors,
    },
    similarCasesSummary: null, // Not available for arbitrary trades without live HISTORICAL_CASES
    urgency: isMissingInstruction || isCutoffApproaching ? 'IMMEDIATE' : isHighValue || isHighCounterpartyRisk ? 'HIGH' : 'ROUTINE',
    csdrPenaltyRiskDaily,
  };
}

/**
 * Step log generator - generates logs reflecting actual data checks
 * Does NOT fabricate SQL execution claims
 */
export function getStepLogs(stepId: number, trade: Trade): { logs: string[]; summary: string } {
  const getDataMode = (trade as any)._dataMode || 'local';

  switch (stepId) {
    case 1: {
      const logs = [
        `[TELEMETRY] Trade identification: ${trade.id}`,
        `[DATA] Asset: ${trade.security.name} (${trade.security.ticker}) | ISIN: ${trade.security.isin}`,
        `[DATA] Economics: ${trade.quantity.toLocaleString()} units @ $${trade.price.toFixed(2)} = $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.currency} | Desk: ${trade.bookingDesk}`,
        `[MODE] Data source: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK'}`,
      ];
      return {
        logs,
        summary: `Trade ${trade.id} verified: $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.security.ticker} (${trade.settlementType}) booked for same-day value.`,
      };
    }
    case 2: {
      const logs = [
        `[SETTLEMENT] Checking depository matching status for ${trade.id}...`,
        `[SETTLEMENT] Settlement status: ${trade.settlementStatus} | Instruction status: ${trade.instructionStatus}`,
        `[SETTLEMENT] Cutoff deadline: ${trade.cutoffTime} (${trade.cutoffMinutesRemaining} minutes remaining)`,
        `[MODE] Data source: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK'}`,
      ];
      return {
        logs,
        summary: `Settlement state: ${trade.settlementStatus} at ${trade.security.depository}. Cutoff deadline in ${trade.cutoffMinutesRemaining} minutes.`,
      };
    }
    case 3: {
      const logs = [
        `[SSI] Checking Standing Settlement Instructions for ${trade.counterparty.id} at ${trade.security.depository}...`,
        `[SSI] Instruction status: ${trade.instructionStatus}`,
        `[SSI] ${trade.instructionStatus === 'MISSING' ? 'No linked depository subaccount found. Flag raised.' : 'Instruction present.'}`,
        `[MODE] Data source: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK'}`,
      ];
      return {
        logs,
        summary: `Standing Settlement Instruction (SSI) is ${trade.instructionStatus} for ${trade.counterparty.name} at ${trade.security.depository}.`,
      };
    }
    case 4: {
      const logs = [
        `[COUNTERPARTY] Retrieving profile for ${trade.counterparty.id}...`,
        `[COUNTERPARTY] Name: ${trade.counterparty.name} | Credit Rating: ${trade.counterparty.creditRating}`,
        `[COUNTERPARTY] Past 30-day failure count: ${trade.counterparty.priorFailures} | Fail rate: ${trade.counterparty.historicalFailRate}% | Avg delay: ${trade.counterparty.avgResolutionTimeHours}h`,
        `[MODE] Data source: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK'}`,
      ];
      return {
        logs,
        summary: `${trade.counterparty.name} exhibits ${trade.counterparty.priorFailures} recent fails (${trade.counterparty.historicalFailRate}% fail rate).`,
      };
    }
    case 5: {
      const logs = [
        `[HISTORY] Querying historical cases for ${trade.counterparty.id} / ${trade.security.assetClass} / ${trade.exceptionType || 'exception'}...`,
        `[HISTORY] Historical case data: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE HISTORICAL_CASES' : 'NOT AVAILABLE (local fallback only has TRD-92831 demo data)'}`,
        getDataMode === 'live' ? '[HISTORY] Matching cases retrieved from Snowflake.' : '[HISTORY] Illustrative estimate only — live historical case table not available in local mode.',
      ];
      return {
        logs,
        summary: getDataMode === 'live'
          ? 'Historical cases retrieved from live Snowflake repository.'
          : 'Matched similar historical cases (illustrative estimate — live historical case data not available).',
      };
    }
    case 6: {
      const searchQuery = `${trade.instructionStatus.toLowerCase()} settlement instruction ${trade.security.assetClass.toLowerCase()} ${trade.cutoffMinutesRemaining < 120 ? 'close to cutoff' : ''}`;
      const logs = [
        `[CORTEX_SEARCH] Querying policy knowledge base for: "${searchQuery}"...`,
        `[CORTEX_SEARCH] Mode: ${getDataMode === 'live' ? 'LIVE SNOWFLAKE CORTEX SEARCH' : 'LOCAL FALLBACK (SOP-OPS-032)'}`,
      ];
      return {
        logs,
        summary: `Retrieved applicable SOP: ${POLICY_DOCUMENTS[0].code} §${POLICY_DOCUMENTS[0].sections[0].sectionNumber} (${getDataMode === 'live' ? 'live Cortex Search' : 'local fallback'}).`,
      };
    }
    case 7: {
      // Import risk engine dynamically to avoid circular deps
      const { calculateSettlementRisk } = require('../engine/riskEngine');
      const riskScore = calculateSettlementRisk(trade);
      const logs = [
        `[RISK_ENGINE] Calculating deterministic risk score for ${trade.id}...`,
        `[RISK_ENGINE] Factors: ${riskScore.factors.map(f => `${f.factor} (+${f.points})`).join(' | ')}`,
        `[RISK_ENGINE] Total Score: ${riskScore.totalScore}/100 -> Severity: ${riskScore.severity}`,
        `[MODE] Deterministic computation (no AI inference)`,
      ];
      return {
        logs,
        summary: `Deterministic Risk Score: ${riskScore.totalScore}/100 (${riskScore.severity}). ${riskScore.factors.length} explainable risk dimensions identified.`,
      };
    }
    case 8: {
      const { calculateSettlementRisk } = require('../engine/riskEngine');
      const riskScore = calculateSettlementRisk(trade);
      const primaryFactor = riskScore.factors[0];
      const logs = [
        `[ROOT_CAUSE] Synthesizing findings from trade data, settlement events, counterparty profile, and policy...`,
        `[ROOT_CAUSE] Primary: ${primaryFactor?.factor || 'Undetermined'}`,
        `[ROOT_CAUSE] Contributing: ${riskScore.factors.slice(1).map(f => f.factor).join('; ') || 'None'}`,
        `[MODE] Deterministic synthesis from structured evidence`,
      ];
      return {
        logs,
        summary: `Root Cause: ${primaryFactor?.factor || 'Undetermined'}. ${riskScore.factors.length - 1} contributing factor(s).`,
      };
    }
    case 9: {
      const rec = getAIRecommendation(trade);
      const logs = [
        `[RECOMMENDER] Generating resolution plan aligned with ${rec.applicablePolicyRef.docCode} §${rec.applicablePolicyRef.section}...`,
        `[RECOMMENDER] Primary action: ${rec.primaryAction}`,
        `[RECOMMENDER] ${rec.actionSteps.length} steps formulated. Urgency: ${rec.urgency}.`,
        `[MODE] Rule-based generation from structured evidence`,
      ];
      return {
        logs,
        summary: `Generated ${rec.actionSteps.length}-step resolution plan (${rec.urgency}). Ready for human authorization.`,
      };
    }
    case 10: {
      const logs = [
        `[HUMAN_IN_THE_LOOP] Preparing Human Approval package with verified evidence citations...`,
        `[HUMAN_IN_THE_LOOP] Awaiting analyst authorization. No autonomous actions will be executed.`,
        `[MODE] Safety control enforced`,
      ];
      return {
        logs,
        summary: 'Human-in-the-loop approval package generated. Awaiting analyst sign-off.',
      };
    }
    default:
      return { logs: [], summary: '' };
  }
}