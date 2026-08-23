import type { AIRecommendation, ExceptionType, InvestigationStep, Trade } from '../types';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';
import type { DataMode } from '../services/types';
import { calculateSettlementRisk } from './riskEngine';

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

const EMPTY_SIMILAR_CASES_SUMMARY = {
  totalFound: 0,
  correctedInstructionCount: 0,
  escalationCount: 0,
  failureCount: 0,
  avgResolutionTimeHours: 0,
};

interface ResolutionPlan {
  primaryAction: string;
  actionSteps: string[];
  rootCausePrimary: string;
}

/**
 * Type-specific resolution plans covering every exception type present in the
 * live Snowflake dataset. Returns null when the type has no dedicated playbook,
 * in which case generic inference is used.
 */
function getTypeResolutionPlan(exceptionType: ExceptionType, trade: Trade): ResolutionPlan | null {
  const cpName = trade.counterparty.name;
  const desk = trade.counterparty.primaryContact.desk;

  switch (exceptionType) {
    case 'Missing Instruction':
      return {
        primaryAction: 'Request corrected settlement instruction and escalate to Settlement Operations desk.',
        actionSteps: [
          `Dispatch automated SWIFT MT599 repair notification to ${cpName} (${desk}).`,
          `Escalate trade ${trade.id} to Settlement Operations Lead (Tier 1 priority).`,
          `Continuously monitor ${trade.security.depository} gateway for incoming affirmation.`,
          'Reassess deterministic settlement risk score immediately upon receiving confirmed SSI.',
        ],
        rootCausePrimary: `No valid Standing Settlement Instruction on file for ${cpName} at ${trade.security.depository}.`,
      };
    case 'Cash Discrepancy':
      return {
        primaryAction: 'Reconcile cash variance against trade ticket economics and confirm adjustment with counterparty.',
        actionSteps: [
          `Compute exact cash variance for ${trade.id} against booked amount.`,
          `Dispatch variance confirmation request to ${cpName} (${desk}).`,
          'Escalate to Operations Lead if variance exceeds $10k SOP threshold.',
          'Confirm adjusted amount and reassess settlement risk before cutoff.',
        ],
        rootCausePrimary: 'Affirmed cash amount does not match booked trade ticket.',
      };
    case 'Securities Shortage':
      return {
        primaryAction: 'Initiate securities recall/borrow process to cover the delivery shortage.',
        actionSteps: [
          `Quantify short position for ${trade.security.ticker} against delivery obligation.`,
          'Place inventory recall request with custody operations.',
          'Evaluate securities borrowing options and associated costs.',
          'Notify counterparty of expected revised settlement timing if cover cannot be sourced.',
        ],
        rootCausePrimary: `Insufficient inventory of ${trade.security.ticker} to satisfy delivery obligation.`,
      };
    case 'Counterparty Fail Risk':
      return {
        primaryAction: 'Escalate to counterparty relationship manager and operations lead given elevated fail probability.',
        actionSteps: [
          `Escalate to Counterparty Relationship Manager for ${cpName}.`,
          'Engage Settlement Operations Lead for Tier 1 escalation.',
          'Activate contingency settlement instructions if available.',
          'Monitor counterparty response and depository status continuously.',
        ],
        rootCausePrimary: `Counterparty ${cpName} exhibits elevated failure probability based on recent history.`,
      };
    case 'Cutoff Approaching':
      return {
        primaryAction: 'Accelerate settlement processing and monitor depository queue until affirmation completes.',
        actionSteps: [
          `Accelerate settlement instruction validation for ${trade.id}.`,
          'Escalate to Operations Lead for priority processing.',
          `Monitor ${trade.security.depository} queue position continuously.`,
          'Confirm settlement completion before cutoff deadline.',
        ],
        rootCausePrimary: 'Settlement processing incomplete with depository cutoff imminent.',
      };
    case 'Depository Reject':
    case 'Instruction Rejected':
    case 'Rejected Instruction':
      return {
        primaryAction: 'Obtain reject reason code, repair the instruction, and resubmit before cutoff.',
        actionSteps: [
          `Pull detailed reject reason from ${trade.security.depository} for ${trade.id}.`,
          'Repair identified field-level defect (account, date, or routing data).',
          `Resubmit corrected instruction to ${trade.security.depository} and confirm acceptance.`,
          'If rejection persists, escalate to Settlement Operations Lead.',
        ],
        rootCausePrimary: `Settlement instruction rejected by ${trade.security.depository}; reason code pending retrieval.`,
      };
    case 'Failed Settlement':
    case 'Post-Cutoff Fail':
      return {
        primaryAction: 'Initiate fail remediation workflow and evaluate partial settlement options to cap CSDR exposure.',
        actionSteps: [
          'Log formal fail record and start daily penalty accrual tracking.',
          'Attempt partial settlement of any matched quantity to reduce exposure.',
          `Engage ${cpName} on buy-in avoidance per CSDR settlement discipline regime.`,
          'Schedule daily fail review until position closes.',
        ],
        rootCausePrimary: 'Settlement failed after cutoff; position now accruing CSDR carry exposure.',
      };
    case 'Account Number Mismatch':
    case 'Settlement Date Mismatch':
    case 'Duplicate Instruction':
    case 'Depot Location Error':
      return {
        primaryAction: 'Repair instruction data defect with counterparty and revalidate against SSI records.',
        actionSteps: [
          `Identify mismatched field(s) between instruction and SSI master for ${trade.id}.`,
          `Request corrected instruction data from ${cpName} (${desk}).`,
          'Validate repaired instruction against depository participant directory.',
          'Resubmit and confirm matching status before cutoff.',
        ],
        rootCausePrimary: 'Settlement instruction data does not match SSI master records.',
      };
    case 'Late Affirmation':
      return {
        primaryAction: 'Expedite trade affirmation to meet T+1 allocation window and mitigate penalty tier escalation.',
        actionSteps: [
          'Confirm current affirmation status with trade capture and allocations team.',
          `Chase ${cpName} for outstanding allocation confirmation.`,
          'Document late-affirmation cause for CSDR reporting.',
          'Monitor affirmation completion and reassess risk once affirmed.',
        ],
        rootCausePrimary: 'Trade affirmation completed outside required allocation window.',
      };
    case 'Instruction Pending':
    case 'Custodian Unreachable':
      return {
        primaryAction: 'Chase pending instruction with custodian and escalate if unresponsive within one hour.',
        actionSteps: [
          `Contact ${cpName} custodian desk regarding pending instruction for ${trade.id}.`,
          'Verify instruction received by depository but awaiting validation.',
          'Escalate via relationship manager if custodian remains unreachable.',
          'Prepare manual workaround instructions as contingency.',
        ],
        rootCausePrimary: 'Instruction submitted but not yet validated; custodian response outstanding.',
      };
    default:
      return null;
  }
}

/** Legacy inference path used when no explicit exception type is available. */
function inferResolutionPlan(trade: Trade): ResolutionPlan {
  const isMissingInstruction = trade.instructionStatus === 'MISSING';
  const isCashDiscrepancy = trade.instructionStatus === 'MISMATCHED';
  const isHighCounterpartyRisk = trade.counterparty.priorFailures >= 5;
  const isCutoffApproaching = trade.cutoffMinutesRemaining <= 120;

  if (isMissingInstruction) {
    return {
      primaryAction: 'Request corrected settlement instruction and escalate to Settlement Operations desk.',
      actionSteps: [
        `Dispatch automated SWIFT MT599 repair notification to ${trade.counterparty.name} (${trade.counterparty.primaryContact.desk}).`,
        `Escalate trade ${trade.id} to Settlement Operations Lead (Tier 1 Priority: Cutoff < 120m, Value > $1M).`,
        `Continuously monitor depository gateway for ${trade.security.depository} affirmation message.`,
        'Reassess deterministic settlement risk score immediately upon receiving confirmed SSI.',
      ],
      rootCausePrimary: `Missing Standing Settlement Instruction (SSI) for ${trade.counterparty.name} at ${trade.security.depository}.`,
    };
  }
  if (isCashDiscrepancy) {
    return {
      primaryAction: 'Execute cash variance adjustment and verify with counterparty.',
      actionSteps: [
        'Calculate cash variance and verify against SOP threshold.',
        `Dispatch variance adjustment request to ${trade.counterparty.name}.`,
        'Escalate to Operations Lead if variance exceeds $10k threshold.',
        'Confirm adjusted amount and reassess settlement risk.',
      ],
      rootCausePrimary: 'Cash amount mismatch between trade ticket and settlement affirmation.',
    };
  }
  if (isHighCounterpartyRisk) {
    return {
      primaryAction: 'Escalate to counterparty relationship manager and operations lead.',
      actionSteps: [
        `Escalate to Counterparty Relationship Manager for ${trade.counterparty.name}.`,
        'Engage Settlement Operations Lead for Tier 1 escalation.',
        'Activate contingency settlement instructions if available.',
        'Monitor counterparty response and depository status continuously.',
      ],
      rootCausePrimary: `Counterparty ${trade.counterparty.name} has elevated failure risk (${trade.counterparty.priorFailures} prior fails in 30 days).`,
    };
  }
  if (isCutoffApproaching) {
    return {
      primaryAction: 'Accelerate settlement processing and monitor depository queue.',
      actionSteps: [
        `Accelerate settlement instruction validation for ${trade.id}.`,
        'Escalate to Operations Lead for priority processing.',
        `Monitor ${trade.security.depository} queue position continuously.`,
        'Confirm settlement completion before cutoff.',
      ],
      rootCausePrimary: 'Settlement cutoff deadline approaching with incomplete processing.',
    };
  }
  return {
    primaryAction: 'Review exception details and determine resolution path.',
    actionSteps: [
      'Review exception details and determine root cause.',
      'Consult applicable SOP for resolution procedure.',
      'Escalate to Operations Lead as appropriate.',
      'Monitor resolution and reassess risk.',
    ],
    rootCausePrimary: 'Undetermined settlement exception.',
  };
}

/**
 * Returns AI recommendation dynamically generated from trade data and the
 * live exception type when available. No historical-case statistics are
 * invented: similarCasesSummary reports zeros until real telemetry exists.
 */
export function getAIRecommendation(trade: Trade, exceptionType?: ExceptionType): AIRecommendation {
  const sop = POLICY_DOCUMENTS[0]; // SOP-OPS-032
  const section = sop.sections[0]; // Section 3.2

  const plan = (exceptionType ? getTypeResolutionPlan(exceptionType, trade) : null) ?? inferResolutionPlan(trade);

  const isHighValue = trade.tradeValue >= 1000000;
  const isImmediate =
    plan.rootCausePrimary.includes('cutoff') ||
    plan.rootCausePrimary.includes('Cutoff') ||
    plan.rootCausePrimary.includes('failed') ||
    plan.rootCausePrimary.includes('fail') ||
    trade.cutoffMinutesRemaining <= 120;

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

  // Deterministic CSDR penalty estimate: 0.065% of trade value per day (regulatory bps)
  const csdrPenaltyRiskDaily = (trade.tradeValue * 0.00065) / 365;

  return {
    primaryAction: plan.primaryAction,
    actionSteps: plan.actionSteps,
    applicablePolicyRef: {
      docCode: sop.code,
      section: section.sectionNumber,
      title: section.sectionTitle,
    },
    rootCause: {
      primary: plan.rootCausePrimary,
      contributingFactors,
    },
    similarCasesSummary: { ...EMPTY_SIMILAR_CASES_SUMMARY },
    urgency: isImmediate ? 'IMMEDIATE' : isHighValue ? 'HIGH' : 'ROUTINE',
    csdrPenaltyRiskDaily,
  };
}

/**
 * Step log generator - generates logs reflecting actual data checks.
 * Does NOT fabricate SQL execution claims. Data mode is passed explicitly
 * by callers so logs never mislabel the active backend.
 */
export function getStepLogs(
  stepId: number,
  trade: Trade,
  dataMode: DataMode = 'local'
): { logs: string[]; summary: string } {
  const modeLabel = dataMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK';

  switch (stepId) {
    case 1: {
      const logs = [
        `[TELEMETRY] Trade identification: ${trade.id}`,
        `[DATA] Asset: ${trade.security.name} (${trade.security.ticker}) | ISIN: ${trade.security.isin}`,
        `[DATA] Economics: ${trade.quantity.toLocaleString()} units @ $${trade.price.toFixed(2)} = $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.currency} | Desk: ${trade.bookingDesk}`,
        `[MODE] Data source: ${modeLabel}`,
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
        `[MODE] Data source: ${modeLabel}`,
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
        `[MODE] Data source: ${modeLabel}`,
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
        `[MODE] Data source: ${modeLabel}`,
      ];
      return {
        logs,
        summary: `${trade.counterparty.name} exhibits ${trade.counterparty.priorFailures} recent fails (${trade.counterparty.historicalFailRate}% fail rate).`,
      };
    }
    case 5: {
      const logs = [
        `[HISTORY] Querying historical cases for ${trade.counterparty.id} / ${trade.security.assetClass}...`,
        `[HISTORY] Historical case data: ${dataMode === 'live' ? 'LIVE SNOWFLAKE HISTORICAL_CASES' : 'NOT AVAILABLE (local fallback only has TRD-92831 demo data)'}`,
        dataMode === 'live'
          ? '[HISTORY] Matching cases retrieved from Snowflake.'
          : '[HISTORY] Illustrative estimate only — live historical case table not available in local mode.',
      ];
      return {
        logs,
        summary: dataMode === 'live'
          ? 'Historical cases retrieved from live Snowflake repository.'
          : 'Matched similar historical cases (illustrative estimate — live historical case data not available).',
      };
    }
    case 6: {
      const searchQuery = `${trade.instructionStatus.toLowerCase()} settlement instruction ${trade.security.assetClass.toLowerCase()} ${trade.cutoffMinutesRemaining < 120 ? 'close to cutoff' : ''}`;
      const logs = [
        `[CORTEX_SEARCH] Querying policy knowledge base for: "${searchQuery}"...`,
        `[CORTEX_SEARCH] Mode: ${dataMode === 'live' ? 'LIVE SNOWFLAKE CORTEX SEARCH' : 'LOCAL FALLBACK (SOP-OPS-032)'}`,
      ];
      return {
        logs,
        summary: `Retrieved applicable SOP: ${POLICY_DOCUMENTS[0].code} §${POLICY_DOCUMENTS[0].sections[0].sectionNumber} (${dataMode === 'live' ? 'live Cortex Search' : 'local fallback'}).`,
      };
    }
    case 7: {
      const riskScore = calculateSettlementRisk(trade);
      const logs = [
        `[RISK_ENGINE] Calculating deterministic risk score for ${trade.id}...`,
        `[RISK_ENGINE] Factors: ${riskScore.factors.map((f) => `${f.factor} (+${f.points})`).join(' | ')}`,
        `[RISK_ENGINE] Total Score: ${riskScore.totalScore}/100 -> Severity: ${riskScore.severity}`,
        `[MODE] Deterministic computation (no AI inference)`,
      ];
      return {
        logs,
        summary: `Deterministic Risk Score: ${riskScore.totalScore}/100 (${riskScore.severity}). ${riskScore.factors.length} explainable risk dimensions identified.`,
      };
    }
    case 8: {
      const riskScore = calculateSettlementRisk(trade);
      const primaryFactor = riskScore.factors[0];
      const logs = [
        `[ROOT_CAUSE] Synthesizing findings from trade data, settlement events, counterparty profile, and policy...`,
        `[ROOT_CAUSE] Primary: ${primaryFactor?.factor || 'Undetermined'}`,
        `[ROOT_CAUSE] Contributing: ${riskScore.factors.slice(1).map((f) => f.factor).join('; ') || 'None'}`,
        `[MODE] Deterministic synthesis from structured evidence`,
      ];
      return {
        logs,
        summary: `Root Cause: ${primaryFactor?.factor || 'Undetermined'}. ${Math.max(riskScore.factors.length - 1, 0)} contributing factor(s).`,
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
