import type { ICortexService, CopilotChatContext, DataMode } from './types';
import type {
  AIRecommendation,
  ExceptionType,
  HistoricalCase,
  InvestigationStep,
  Trade
} from '../types';
import { fetchCortexSearch, fetchCortexAnalyst } from './apiClient';
import { generateInitialSteps, getAIRecommendation, getStepLogs } from '../engine/agentOrchestrator';
import { calculateSettlementRisk } from '../engine/riskEngine';

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
    return generateInitialSteps();
  }

  public async executeStep(
    stepId: number,
    trade: Trade,
    dataMode: DataMode = 'local'
  ): Promise<{ logs: string[]; summary: string }> {
    // Delegate to the shared agentOrchestrator for consistent behavior
    return getStepLogs(stepId, trade, dataMode);
  }

  public async generateRecommendation(trade: Trade, exceptionType?: ExceptionType): Promise<AIRecommendation> {
    // Delegate to the shared agentOrchestrator for consistent behavior
    return getAIRecommendation(trade, exceptionType);
  }

  public async getHistoricalCases(_trade: Trade): Promise<{ cases: HistoricalCase[]; summary: any }> {
    // Local fallback has no HISTORICAL_CASES table — report zero honestly.
    return {
      cases: [],
      summary: {
        totalFound: 0,
        note: 'Historical case data not available in local fallback. Enable live Snowflake mode for full history.',
      },
    };
  }

  public async queryCopilot(query: string, context?: CopilotChatContext): Promise<{
    text: string;
    structuredData?: any;
    suggestedFollowUps?: string[];
  }> {
    const lower = query.toLowerCase();
    const trade = context?.trade;
    // Risk score comes only from caller-supplied context or deterministic engine — never invented.
    const riskScore = context?.riskScore;

    // Query 1: "Show me critical settlement exceptions approaching cutoff."
    if (lower.includes('show me critical') || lower.includes('approaching cutoff') || lower.includes('overview') || lower.includes('critical exceptions')) {
      if (trade) {
        return {
          text: `Monitoring institutional settlement flows. The highest-risk case in current view is **${trade.id}** with a deterministic score of **${riskScore ?? 'N/A'}/100** ($${(trade.tradeValue / 1000000).toFixed(1)}M ${trade.security.ticker} trade with ${trade.counterparty.name}, cutoff in ${Math.floor(trade.cutoffMinutesRemaining / 60)}h ${trade.cutoffMinutesRemaining % 60}m).`,
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
        // Always compute the breakdown deterministically from live trade data.
        const score = calculateSettlementRisk(trade);
        const breakdown = score.factors.map((f) => ({
          label: f.factor,
          points: f.points,
          note: f.explanation,
        }));
        return {
          text: `**${trade.id}** is scored at **${score.totalScore}/100** by ClearSet's deterministic risk engine. Here is the exact, explainable point breakdown from telemetry data:`,
          structuredData: {
            type: 'risk_breakdown',
            tradeId: trade.id,
            riskScore: score.totalScore,
            pointsBreakdown: breakdown,
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
          text: `Based on **${rec.applicablePolicyRef.docCode} §${rec.applicablePolicyRef.section}** (*${rec.applicablePolicyRef.title}*), ClearSet recommends the following mandatory actions:`,
          structuredData: {
            type: 'sop_citation',
            policyCitation: {
              doc: rec.applicablePolicyRef.docCode,
              section: rec.applicablePolicyRef.section,
              text: `Mandatory Protocol: ${rec.actionSteps.join(' ')}`,
            },
            recommendation: `${rec.primaryAction}`,
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
              note: 'Historical case matching requires a populated HISTORICAL_CASES table — reported as zero until available.',
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
   * All other steps delegate to local. dataMode threads through so step logs
   * always label the true backend.
   */
  public async executeStep(
    stepId: number,
    trade: Trade,
    dataMode: DataMode = 'local'
  ): Promise<{ logs: string[]; summary: string }> {
    if (stepId === 6 && dataMode === 'live') {
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
    return this.local.executeStep(stepId, trade, dataMode);
  }

  public async generateRecommendation(trade: Trade, exceptionType?: ExceptionType): Promise<AIRecommendation> {
    return this.local.generateRecommendation(trade, exceptionType);
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
    context?: CopilotChatContext,
  ): Promise<{ text: string; structuredData?: any; suggestedFollowUps?: string[] }> {
    try {
      const response = await fetchCortexAnalyst(query);

      if (response.success && response.mode === 'snowflake') {
        const sql = response.sql;
        const data = response.data || [];
        const interpretation = response.interpretation || '';

        if (sql && data.length > 0) {
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
              tradeId: context?.trade.id,
            },
            suggestedFollowUps: context?.trade
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

        if (interpretation) {
          return {
            text: interpretation,
            suggestedFollowUps: context?.trade
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

    return this.local.queryCopilot(query, context);
  }
}

export const cortexService: ICortexService = new HybridCortexService(
  new LocalCortexService(),
);
