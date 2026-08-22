import type { ICortexService } from './types';
import type { 
  AIRecommendation, 
  HistoricalCase, 
  InvestigationStep, 
  Trade 
} from '../types';
import { 
  COUNTERPARTIES 
} from '../data/syntheticData';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';
import { fetchCortexSearch, fetchCortexAnalyst } from './apiClient';
import { getAIRecommendation, getStepLogs } from '../engine/agentOrchestrator';

/** Converts arbitrary Cortex response values into display-safe text. */
function formatCortexValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Unserializable value]';
    }
  }
  return String(value);
}

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

function buildSearchQuery(trade: Trade): string {
  const parts = [
    trade.instructionStatus.toLowerCase().replace('_', ' '),
    'settlement instruction',
    trade.security.assetClass.toLowerCase(),
  ];
  if (trade.cutoffMinutesRemaining < 120) {
    parts.push('close to cutoff');
  }
  if (trade.counterparty.priorFailures >= 5) {
    parts.push('counterparty fail risk');
  }
  return parts.join(' ');
}

export class LocalCortexService implements ICortexService {
  public getInvestigationSteps(): InvestigationStep[] {
    return INVESTIGATION_STEPS_TEMPLATE.map((step) => ({
      ...step,
      status: 'PENDING',
      logs: [],
    }));
  }

  public async executeStep(stepId: number, trade: Trade): Promise<{ logs: string[]; summary: string }> {
    // Delegate to the shared agentOrchestrator for consistent behavior
    return getStepLogs(stepId, trade);
  }

  public async generateRecommendation(trade: Trade): Promise<AIRecommendation> {
    // Delegate to the shared agentOrchestrator for consistent behavior
    return getAIRecommendation(trade);
  }

  public async getHistoricalCases(_trade: Trade): Promise<{ cases: HistoricalCase[]; summary: any }> {
    // Local fallback only has TRD-92831 demo data
    // In live mode, this would query HISTORICAL_CASES table or Cortex Search
    return {
      cases: [],
      summary: { 
        totalFound: 0, 
        note: 'Historical case data not available in local fallback. Enable live Snowflake mode for full history.' 
      },
    };
  }

  public async queryCopilot(query: string, activeTrade?: Trade): Promise<{
    text: string;
    structuredData?: any;
    suggestedFollowUps?: string[];
  }> {
    const lower = query.toLowerCase();
    const trade = activeTrade;

    // Helper to get the highest-risk exception from context
    const getTopException = () => {
      if (!trade) return null;
      // We don't have access to all exceptions here, so use active trade
      return trade;
    };

    // Query 1: "Show me critical settlement exceptions approaching cutoff."
    if (lower.includes('show me critical') || lower.includes('approaching cutoff') || lower.includes('overview') || lower.includes('critical exceptions')) {
      if (trade) {
        return {
          text: `Monitoring institutional settlement flows. The highest-risk case in current view is **${trade.id}** with a deterministic score of **${trade.riskScore?.totalScore || 'N/A'}/100** ($${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.security.ticker} trade with ${trade.counterparty.name}, cutoff in ${Math.floor(trade.cutoffMinutesRemaining / 60)}h ${trade.cutoffMinutesRemaining % 60}m).`,
          structuredData: {
            type: 'trade_card',
            tradeSummary: {
              id: trade.id,
              value: `$${trade.tradeValue.toLocaleString()}`,
              cp: `${trade.counterparty.name} (${trade.counterparty.id})`,
              isin: `${trade.security.isin} (${trade.security.ticker})`,
              cutoff: `${Math.floor(trade.cutoffMinutesRemaining / 60)}h ${trade.cutoffMinutesRemaining % 60}m remaining (${trade.cutoffTime})`,
            },
          },
          suggestedFollowUps: [
            'Why is this trade critical?',
            'What should I do according to our SOP?',
            'Have we seen this counterparty fail before?',
            `Investigate ${trade.id}.`,
          ],
        };
      }
      return {
        text: 'No active trade selected. Please select an exception from the dashboard or exceptions queue to view critical details.',
        suggestedFollowUps: [
          'Show me critical settlement exceptions approaching cutoff.',
          'What should I do according to our SOP?',
        ],
      };
    }

    // Query 2: "Investigate [trade]" or "Investigate"
    if (lower.includes('investigate')) {
      if (trade) {
        return {
          text: `Initiating procedural investigation for **${trade.id}** ($${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.security.ticker}). Executing 10-step verification workflow across trades, settlement instructions, counterparty failure records, and SOP knowledge base...`,
          structuredData: {
            type: 'investigation_launch',
            tradeId: trade.id,
          },
          suggestedFollowUps: [
            'Why is this trade critical?',
            'What should I do according to our SOP?',
            'Have we seen this counterparty fail before?',
          ],
        };
      }
      return {
        text: 'Please specify a trade ID to investigate, or select an exception from the dashboard.',
        suggestedFollowUps: ['Investigate the highest-risk exception.'],
      };
    }

    // Query 3: "Why is [trade] critical?" or "Why is it critical?"
    if ((lower.includes('why is') && (lower.includes('critical') || lower.includes('risk'))) || lower.includes('risk breakdown')) {
      if (trade) {
        const riskScore = trade.riskScore?.totalScore || 0;
        const factors = trade.riskScore?.factors || [];
        const breakdown = factors.map(f => ({
          label: f.factor,
          points: f.points,
          note: f.explanation,
        }));
        return {
          text: `**${trade.id}** is scored at **${riskScore}/100** by ClearSet's deterministic risk engine. Here is the exact, explainable point breakdown from telemetry data:`,
          structuredData: {
            type: 'risk_breakdown',
            tradeId: trade.id,
            riskScore,
            pointsBreakdown: breakdown.length > 0 ? breakdown : [
              { label: 'Instruction Risk', points: 25, note: trade.instructionStatus === 'MISSING' ? 'Missing SSI' : 'N/A' },
              { label: 'Cutoff Urgency', points: trade.cutoffMinutesRemaining <= 120 ? 25 : trade.cutoffMinutesRemaining <= 240 ? 15 : 8, note: `${trade.cutoffMinutesRemaining} minutes remaining` },
              { label: 'Financial Exposure', points: trade.tradeValue >= 2000000 ? 20 : trade.tradeValue >= 1000000 ? 15 : 10, note: `$${(trade.tradeValue / 1000000).toFixed(1)}M` },
              { label: 'Counterparty Risk', points: trade.counterparty.priorFailures >= 5 ? 15 : trade.counterparty.priorFailures >= 2 ? 10 : 5, note: `${trade.counterparty.priorFailures} prior failures` },
              { label: 'Institutional Memory', points: 6, note: 'Historical pattern match' },
            ],
          },
          suggestedFollowUps: [
            'What should I do according to our SOP?',
            'Have we seen this counterparty fail before?',
            'Open full investigation workspace',
          ],
        };
      }
      return {
        text: 'No active trade selected. Please select an exception to view its risk breakdown.',
        suggestedFollowUps: ['Show me critical settlement exceptions approaching cutoff.'],
      };
    }

    // Query 4: "What should I do according to our SOP?"
    if (lower.includes('what should i do') || lower.includes('sop') || lower.includes('recommend') || lower.includes('procedure')) {
      if (trade) {
        const rec = getAIRecommendation(trade);
        return {
          text: `Based on **${rec.applicablePolicyRef.doc} §${rec.applicablePolicyRef.section}** (*${rec.applicablePolicyRef.title}*), ClearSet recommends the following mandatory actions:`,
          structuredData: {
            type: 'sop_citation',
            policyCitation: {
              doc: rec.applicablePolicyRef.doc,
              section: rec.applicablePolicyRef.section,
              text: `Mandatory Protocol: ${rec.actionSteps.join(' ')}`,
            },
            recommendation: `${rec.primaryAction} Estimated daily CSDR penalty avoided: $${rec.csdrPenaltyRiskDaily.toFixed(2)}.`,
          },
          suggestedFollowUps: [
            'Have we seen this counterparty fail before?',
            'Why is this trade critical?',
            'Open full investigation workspace',
          ],
        };
      }
      return {
        text: 'No active trade selected. Please select an exception to view SOP guidance.',
        suggestedFollowUps: ['Show me critical settlement exceptions approaching cutoff.'],
      };
    }

    // Query 5: "Have we seen this counterparty fail before?" / counterparty history
    if (lower.includes('have we seen') || lower.includes('counterparty fail') || lower.includes('history') || lower.includes('similar cases')) {
      if (trade) {
        const cp = trade.counterparty;
        return {
          text: `Yes. **${cp.name} (${cp.id})** has a documented record of **${cp.priorFailures} settlement failures** in the past 30 days with a **${cp.historicalFailRate}% failure rate** and an average delay of **${cp.avgResolutionTimeHours} hours**.\n\nCounterparty intelligence from ${cp.creditRating}-rated entity. Desk contact: ${cp.primaryContact.name} (${cp.primaryContact.desk}).`,
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
              total: 0,
              note: 'Historical case matching requires live Snowflake HISTORICAL_CASES table.',
            },
          },
          suggestedFollowUps: [
            'Why is this trade critical?',
            'What should I do according to our SOP?',
            `Investigate ${trade.id}`,
          ],
        };
      }
      return {
        text: 'No active trade selected. Please select an exception to view counterparty intelligence.',
        suggestedFollowUps: ['Show me critical settlement exceptions approaching cutoff.'],
      };
    }

    // Default fallback
    const suggestions = trade
      ? [
          'Why is this trade critical?',
          'What should I do according to our SOP?',
          'Have we seen this counterparty fail before?',
          `Investigate ${trade.id}`,
        ]
      : [
          'Show me critical settlement exceptions approaching cutoff.',
          'What should I do according to our SOP?',
        ];

    return {
      text: trade
        ? `ClearSet AI analyzed: "${query}" for **${trade.id}**.\n\nI am configured for post-trade exception detection, deterministic risk scoring, SOP retrieval, and counterparty failure analysis.`
        : `ClearSet AI analyzed: "${query}".\n\nI am configured for post-trade exception detection, deterministic risk scoring, SOP retrieval, and counterparty failure analysis. Please select an exception from the dashboard to begin.`,
      suggestedFollowUps: suggestions,
    };
  }
}

// ============================================================================
// HybridCortexService
// Wraps LocalCortexService. For queryCopilot, tries Cortex Analyst (REST).
// For executeStep(6) [policy retrieval], tries Cortex Search.
// Falls back to LocalCortexService on any error or unavailability.
// ============================================================================
class HybridCortexService implements ICortexService {
  private local: LocalCortexService;

  constructor(local: LocalCortexService) {
    this.local = local;
  }

  public getInvestigationSteps(): InvestigationStep[] {
    return this.local.getInvestigationSteps();
  }

  /**
   * executeStep — step 6 (policy retrieval) is enhanced with Cortex Search.
   * All other steps delegate to local.
   */
  public async executeStep(
    stepId: number,
    trade: Trade,
  ): Promise<{ logs: string[]; summary: string }> {
    if (stepId === 6) {
      try {
        const query = buildSearchQuery(trade);
        const response = await fetchCortexSearch(query, 3);

        if (response.success && response.mode === 'snowflake' && response.results.length > 0) {
          const top = response.results[0];
          const docCode = formatCortexValue(top['DOC_CODE']);
          const policyName = formatCortexValue(top['POLICY_NAME']);
          const policySection = formatCortexValue(top['POLICY_SECTION']);
          const chunkText = formatCortexValue(top['CHUNK_TEXT']);

          return {
            logs: [
              `[CORTEX_SEARCH_KB] Querying Snowflake Cortex Search for "${query}"...`,
              `[KB_RETRIEVAL] Top Match: ${docCode} (${policyName}), Section: ${policySection}`,
              `[KB_POLICY] ${chunkText.slice(0, 200)}${chunkText.length > 200 ? '...' : ''}`,
            ],
            summary: `Retrieved ${docCode} §${policySection}: ${policyName}. Live Snowflake Cortex Search result.`,
          };
        }
      } catch {
        // fall through to local
      }
    }
    return this.local.executeStep(stepId, trade);
  }

  public async generateRecommendation(trade: Trade): Promise<AIRecommendation> {
    return this.local.generateRecommendation(trade);
  }

  public async getHistoricalCases(trade: Trade): Promise<{ cases: HistoricalCase[]; summary: any }> {
    return this.local.getHistoricalCases(trade);
  }

  /**
   * queryCopilot — tries Cortex Analyst via POST /api/cortex/analyst.
   * If successful, formats the SQL result data into a human-readable response.
   * Falls back to LocalCortexService on any failure.
   */
  public async queryCopilot(
    query: string,
    activeTrade?: Trade,
  ): Promise<{ text: string; structuredData?: any; suggestedFollowUps?: string[] }> {
    try {
      const response = await fetchCortexAnalyst(query);

      if (response.success && response.mode === 'snowflake') {
        // Build a response from Cortex Analyst data
        const sql = response.sql;
        const data = response.data || [];
        const interpretation = response.interpretation || '';

        if (sql && data.length > 0) {
          // Format the data rows as a markdown table-like summary
          const rowSummaries = data.slice(0, 5).map((row) => {
            return Object.entries(row)
              .map(([k, v]) => `**${k}**: ${formatCortexValue(v)}`)
              .join(' | ');
          });

          const text = interpretation
            ? `${interpretation}\n\n${rowSummaries.join('\n')}`
            : `Cortex Analyst returned ${data.length} result${data.length > 1 ? 's' : ''}:\n\n${rowSummaries.join('\n')}`;

          return {
            text,
            structuredData: {
              type: 'investigation_summary' as const,
              tradeId: activeTrade?.id,
            },
            suggestedFollowUps: activeTrade
              ? [
                  'Why is this trade critical?',
                  'What should I do according to our SOP?',
                  'Have we seen this counterparty fail before?',
                ]
              : [
                  'Show me critical settlement exceptions approaching cutoff.',
                  'What should I do according to our SOP?',
                ],
          };
        }

        // Cortex Analyst responded but no SQL/data — use interpretation text if present
        if (interpretation) {
          return {
            text: interpretation,
            suggestedFollowUps: activeTrade
              ? [
                  'Why is this trade critical?',
                  'What should I do according to our SOP?',
                ]
              : [
                  'Show me critical settlement exceptions approaching cutoff.',
                  'What should I do according to our SOP?',
                ],
          };
        }
      }
    } catch {
      // Cortex Analyst unavailable — fall through to local
    }

    return this.local.queryCopilot(query, activeTrade);
  }
}

export const cortexService: ICortexService = new HybridCortexService(
  new LocalCortexService(),
);