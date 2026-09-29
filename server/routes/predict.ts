import { Request, Response } from 'express';
import { predictSingle, getModelMetrics, TradeFeatures } from '../services/predictiveEngine.js';

/**
 * GET /api/predict
 * Returns failure predictions for all open trades
 * Query params: tradeId (optional) - single trade prediction
 */
export const getPredictions = async (req: Request, res: Response) => {
  try {
    const { tradeId } = req.query;

    // In production, fetch from Snowflake
    // For now, use mock data that matches the schema
    const mockTrades: TradeFeatures[] = [
      {
        tradeId: 'TRD-92831',
        cpId: 'CP-192',
        cpFailRate: 8.4,
        cpPriorFailures30d: 7,
        tradeValue: 2_400_000,
        assetClass: 'Equities',
        depository: 'DTC',
        instructionStatus: 'MISSING',
        daysToCutoff: 1,
        settlementType: 'DVP',
      },
      {
        tradeId: 'TRD-81232',
        cpId: 'CP-104',
        cpFailRate: 4.1,
        cpPriorFailures30d: 6,
        tradeValue: 8_100_000,
        assetClass: 'Fixed Income',
        depository: 'Fedwire',
        instructionStatus: 'MISMATCHED',
        daysToCutoff: 0.5,
        settlementType: 'DVP',
      },
      {
        tradeId: 'TRD-90001',
        cpId: 'CP-301',
        cpFailRate: 2.4,
        cpPriorFailures30d: 2,
        tradeValue: 3_250_000,
        assetClass: 'Equities',
        depository: 'DTC',
        instructionStatus: 'MISSING',
        daysToCutoff: 2,
        settlementType: 'DVP',
      },
      {
        tradeId: 'TRD-90008',
        cpId: 'CP-308',
        cpFailRate: 7.6,
        cpPriorFailures30d: 8,
        tradeValue: 5_200_000,
        assetClass: 'Equities',
        depository: 'DTC',
        instructionStatus: 'MISSING',
        daysToCutoff: 0.5,
        settlementType: 'DVP',
      },
      {
        tradeId: 'TRD-90005',
        cpId: 'CP-305',
        cpFailRate: 3.5,
        cpPriorFailures30d: 3,
        tradeValue: 6_500_000,
        assetClass: 'Corporate Bond',
        depository: 'Fedwire',
        instructionStatus: 'REJECTED',
        daysToCutoff: 1,
        settlementType: 'DVP',
      },
    ];

    const withContext = (trade: TradeFeatures) => ({
      ...predictSingle(trade),
      cpId: trade.cpId,
      cpFailRate: trade.cpFailRate,
      tradeValue: trade.tradeValue,
      instructionStatus: trade.instructionStatus,
      daysToCutoff: trade.daysToCutoff,
      assetClass: trade.assetClass,
      depository: trade.depository,
      settlementType: trade.settlementType,
      csdrDailyExposure: Math.round(trade.tradeValue * 0.00025 * 100) / 100,
    });

    let predictions;
    if (tradeId) {
      const trade = mockTrades.find(t => t.tradeId === tradeId);
      if (!trade) {
        return res.status(404).json({ success: false, error: 'Trade not found' });
      }
      predictions = [withContext(trade)];
    } else {
      predictions = mockTrades.map(withContext);
    }

    // Sort by failure probability descending
    predictions.sort((a, b) => b.failureProbability - a.failureProbability);

    return res.json({
      success: true,
      mode: 'snowflake',
      generatedAt: new Date().toISOString(),
      modelMetrics: getModelMetrics(),
      data: predictions,
    });
  } catch (error) {
    console.error('[Predict] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Prediction generation failed',
    });
  }
};

/**
 * GET /api/predict/metrics
 * Returns model performance metrics
 */
export const getMetrics = async (_req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      data: getModelMetrics(),
    });
  } catch (error) {
    console.error('[Predict Metrics] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
    });
  }
};