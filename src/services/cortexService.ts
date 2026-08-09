import type { ICortexService } from './types';
import type { 
  AIRecommendation, 
  HistoricalCase, 
  InvestigationStep, 
  Trade 
} from '../types';
import { 
  HISTORICAL_CASES_TRD92831, 
  HISTORICAL_SUMMARY_TRD92831,
  COUNTERPARTIES 
} from '../data/syntheticData';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';

const INVESTIGATION_STEPS_TEMPLATE: Omit<InvestigationStep, 'status' | 'logs'>[] = [
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

export class LocalCortexService implements ICortexService {
  public getInvestigationSteps(): InvestigationStep[] {
    return INVESTIGATION_STEPS_TEMPLATE.map((step) => ({
      ...step,
      status: 'PENDING',
      logs: [],
    }));
  }

  public async executeStep(stepId: number, trade: Trade): Promise<{ logs: string[]; summary: string }> {
    switch (stepId) {
      case 1:
        return {
          logs: [
            `[TELEMETRY_ENGINE] SELECT * FROM TRADES JOIN SECURITIES ON TRADES.ISIN = SECURITIES.ISIN WHERE TRADE_ID = '${trade.id}';`,
            `[DATA_MASTER] Verified Trade: ${trade.id} | Asset: ${trade.security.name} (${trade.security.ticker}) | ISIN: ${trade.security.isin}`,
            `[DATA_MASTER] Economics: ${trade.quantity.toLocaleString()} units @ $${trade.price.toFixed(2)} = $${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.currency} | Desk: ${trade.bookingDesk}`,
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
            `[CORTEX_ANALYST_QUERY] SELECT * FROM COUNTERPARTIES WHERE CP_ID = '${trade.counterparty.id}';`,
            `[CP_PROFILE] Name: ${trade.counterparty.name} | Credit Rating: ${trade.counterparty.creditRating}`,
            `[CP_PROFILE] Past 30-day failure count: ${trade.counterparty.priorFailures} fails | Fail rate: ${trade.counterparty.historicalFailRate}% | Avg delay: ${trade.counterparty.avgResolutionTimeHours}h`,
            `[RISK_ASSESSMENT] Counterparty classified as High-Friction Operator under POL-RSK-008.`,
          ],
          summary: `${trade.counterparty.name} exhibits ${trade.counterparty.priorFailures} recent fails (8.4% fail rate).`,
        };
      case 5:
        return {
          logs: [
            `[CORTEX_SEARCH_VECTOR] Querying HISTORICAL_CASES with embedding for 'Missing SSI + US Equities + ${trade.counterparty.name}'...`,
            `[HISTORY_MATCH] Found 18 similar historical cases (Average similarity: 93.4%).`,
            `[RESOLUTION_ANALYSIS] Breakdown: 12 Corrected SSI (66.7%), 4 Escalated (22.2%), 2 Failed (11.1%). Avg resolution time: 3.8 hours.`,
          ],
          summary: 'Matched 18 similar historical cases. 88.9% resolved successfully via proactive repair.',
        };
      case 6:
        return {
          logs: [
            `[CORTEX_SEARCH_KB] Querying Knowledge Base for 'Missing settlement instruction close to cutoff threshold'...`,
            `[KB_RETRIEVAL] Matched Document: SOP-OPS-032 (Settlement Exception SOP), Section 3.2: 'Missing Settlement Instructions & Expedited SSI Repair'.`,
            `[KB_POLICY] Mandatory Action: Request expedited repair via SWIFT/ISO 20022 and trigger Tier 1 supervisor escalation.`,
          ],
          summary: 'Retrieved SOP-OPS-032 Section 3.2: Mandatory expedited repair and desk escalation required.',
        };
      case 7:
        return {
          logs: [
            `[RISK_ENGINE] Running deterministic formula for Trade ${trade.id}...`,
            `[RISK_ENGINE] Factors: Missing SSI (+25) | Cutoff < 120m (+25) | Value > $1M (+20) | CP Fails > 5 (+15) | History (+6)`,
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
            `[HUMAN_IN_THE_LOOP] Awaiting analyst authorization. System will execute dispatch upon confirmation.`,
          ],
          summary: 'Human-in-the-loop approval package generated. Awaiting analyst sign-off.',
        };
      default:
        return { logs: [], summary: '' };
    }
  }

  public async generateRecommendation(trade: Trade): Promise<AIRecommendation> {
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

  public async getHistoricalCases(_trade: Trade): Promise<{ cases: HistoricalCase[]; summary: any }> {
    return {
      cases: [...HISTORICAL_CASES_TRD92831],
      summary: { ...HISTORICAL_SUMMARY_TRD92831 },
    };
  }

  public async queryCopilot(query: string, _activeTrade?: Trade): Promise<{
    text: string;
    structuredData?: any;
    suggestedFollowUps?: string[];
  }> {
    const lower = query.toLowerCase();

    // Query 1: "Show me critical settlement exceptions approaching cutoff."
    if (lower.includes('show me critical') || lower.includes('approaching cutoff') || lower.includes('overview') || lower.includes('critical exceptions')) {
      return {
        text: 'There are **42 critical exceptions** currently approaching settlement cutoffs across firm positions, representing **$84.6M in gross exposure**.\n\nThe highest-risk case is **TRD-92831** with a deterministic score of **91/100** ($2.4M AAPL trade with Apex Prime Clearing, cutoff in 1h 42m).',
        structuredData: {
          type: 'trade_card',
          tradeSummary: {
            id: 'TRD-92831',
            value: '$2,400,000.00',
            cp: 'Apex Prime Clearing Ltd. (CP-192)',
            isin: 'US0378331005 (AAPL)',
            cutoff: '1h 42m remaining (15:30 EST)',
          },
        },
        suggestedFollowUps: [
          'Why is TRD-92831 critical?',
          'What should I do according to our SOP?',
          'Have we seen this counterparty fail before?',
          'Investigate TRD-92831.',
        ],
      };
    }

    // Query 2: "Investigate TRD-92831."
    if (lower.includes('investigate trd-92831') || (lower.includes('investigate') && lower.includes('92831'))) {
      return {
        text: 'Initiating procedural investigation for **TRD-92831** ($2.4M AAPL). Executing 10-step verification workflow across trades, settlement instructions, counterparty failure records, and SOP knowledge base...',
        structuredData: {
          type: 'investigation_launch',
          tradeId: 'TRD-92831',
        },
        suggestedFollowUps: [
          'Why is TRD-92831 critical?',
          'What should I do according to our SOP?',
          'Have we seen this counterparty fail before?',
        ],
      };
    }

    // Query 3: "Why is TRD-92831 critical?"
    if (lower.includes('why is trd-92831 critical') || (lower.includes('why') && lower.includes('92831')) || lower.includes('why is it critical')) {
      return {
        text: '**TRD-92831** is scored at **91/100 (CRITICAL)** by ClearSet\'s deterministic risk engine. Here is the exact, explainable point breakdown from telemetry data:',
        structuredData: {
          type: 'risk_breakdown',
          tradeId: 'TRD-92831',
          riskScore: 91,
          pointsBreakdown: [
            { label: 'Missing Settlement Instruction (SSI)', points: 25, note: 'No linked subaccount found for DTC Participant 0244' },
            { label: 'Depository Cutoff Approaching', points: 25, note: 'Only 1h 42m remaining until 15:30 EST DTC intraday cutoff' },
            { label: 'High Trade Value Exposure', points: 20, note: '$2.4M gross transaction value exceeds $1.0M high-risk tier' },
            { label: 'Counterparty History (CP-192)', points: 15, note: '7 previous settlement failures in past 30 days (8.4% fail rate)' },
            { label: 'Similar Historical Precedents', points: 6, note: '18 prior cases match this failure pattern' },
          ],
        },
        suggestedFollowUps: [
          'What should I do according to our SOP?',
          'Have we seen this counterparty fail before?',
          'Open full investigation workspace',
        ],
      };
    }

    // Query 4: "What should I do according to our SOP?"
    if (lower.includes('what should i do') || lower.includes('sop') || lower.includes('recommend') || lower.includes('procedure')) {
      return {
        text: 'Based on **Settlement Exception SOP §3.2** (*Missing Settlement Instructions & Expedited SSI Repair Protocol*), ClearSet recommends the following mandatory actions:',
        structuredData: {
          type: 'sop_citation',
          policyCitation: {
            doc: 'SOP-OPS-032 (Settlement Exception Standard Operating Procedure)',
            section: 'Section 3.2',
            text: 'Mandatory Protocol: 1. Request corrected SSI via SWIFT MT599. 2. Escalate to Settlement Operations Lead. 3. Monitor DTC depository queue until confirmed.',
          },
          recommendation: 'Request corrected instruction and escalate to Settlement Operations. Estimated daily CSDR penalty avoided: $1,566.67.',
        },
        suggestedFollowUps: [
          'Have we seen this counterparty fail before?',
          'Why is TRD-92831 critical?',
          'Open full investigation workspace',
        ],
      };
    }

    // Query 5: "Have we seen this counterparty fail before?"
    if (lower.includes('have we seen') || lower.includes('counterparty fail') || lower.includes('cp-192') || lower.includes('history') || lower.includes('similar cases')) {
      const cp = COUNTERPARTIES['CP-192'];
      return {
        text: `Yes. **Apex Prime Clearing Ltd. (CP-192)** has a documented record of **${cp.priorFailures} settlement failures** in the past 30 days with an **${cp.historicalFailRate}% failure rate** and an average delay of **${cp.avgResolutionTimeHours} hours**.\n\nClearSet's historical repository identified **18 similar cases** for CP-192 involving missing SSI on US Equities:\n• **12 cases (66.7%)** resolved via expedited SWIFT repair\n• **4 cases (22.2%)** resolved via desk escalation\n• **2 cases (11.1%)** resulted in depository settlement failure\n\n**Institutional Playbook Success Rate:** 88.9% with proactive MT599 dispatch.`,
        structuredData: {
          type: 'counterparty_intelligence',
          counterparty: {
            id: cp.id,
            name: cp.name,
            bic: cp.bic,
            rating: cp.creditRating,
            failures: cp.priorFailures,
            failRate: `${cp.historicalFailRate}%`,
            contact: cp.primaryContact.name,
            desk: cp.primaryContact.desk,
          },
          similarCases: {
            total: 18,
            corrected: 12,
            escalated: 4,
            failed: 2,
            avgHours: 3.8,
          },
        },
        suggestedFollowUps: [
          'Why is TRD-92831 critical?',
          'What should I do according to our SOP?',
          'Investigate TRD-92831',
        ],
      };
    }

    return {
      text: `ClearSet AI analyzed: "${query}".\n\nI am configured for post-trade exception detection, deterministic risk scoring, SOP retrieval, and counterparty failure analysis. Try asking about **TRD-92831**, cutoff urgency, or counterparty history.`,
      suggestedFollowUps: [
        'Why is TRD-92831 critical?',
        'What should I do according to our SOP?',
        'Have we seen this counterparty fail before?',
      ],
    };
  }
}

export const cortexService: ICortexService = new LocalCortexService();
