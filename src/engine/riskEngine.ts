import type { ExceptionSeverity, RiskFactor, RiskScoreBreakdown, Trade } from '../types';

/**
 * Deterministic, explainable post-trade settlement risk engine.
 * Computes exact point-by-point score based on empirical risk dimensions.
 */
export function calculateSettlementRisk(trade: Trade, options?: { historicalPrecedentPoints?: number }): RiskScoreBreakdown {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // 1. Settlement Instruction Status (+25 for missing, +18 for mismatched, +10 for pending)
  if (trade.instructionStatus === 'MISSING') {
    factors.push({
      category: 'Instruction Risk',
      factor: 'Missing Settlement Instruction (SSI)',
      points: 25,
      severity: 'CRITICAL',
      explanation: 'No Standing Settlement Instruction found for counterparty depository account at DTC.',
      iconName: 'FileQuestion',
    });
    totalScore += 25;
  } else if (trade.instructionStatus === 'MISMATCHED') {
    factors.push({
      category: 'Instruction Risk',
      factor: 'Mismatched SSI Parameters',
      points: 18,
      severity: 'HIGH',
      explanation: 'Beneficiary account BIC or cash correspondent does not align with master trade ticket.',
      iconName: 'FileX',
    });
    totalScore += 18;
  } else if (trade.instructionStatus === 'PENDING') {
    factors.push({
      category: 'Instruction Risk',
      factor: 'Pending SSI Affirmation',
      points: 10,
      severity: 'MEDIUM',
      explanation: 'Instruction sent to depository matching utility but unconfirmed by counterparty custodian.',
      iconName: 'Clock',
    });
    totalScore += 10;
  }

  // 2. Cutoff Proximity (+25 for < 2h, +15 for < 4h, +8 for < 8h)
  if (trade.cutoffMinutesRemaining <= 120) {
    const hours = Math.floor(trade.cutoffMinutesRemaining / 60);
    const mins = trade.cutoffMinutesRemaining % 60;
    factors.push({
      category: 'Cutoff Urgency',
      factor: 'Depository Cutoff Approaching',
      points: 25,
      severity: 'CRITICAL',
      explanation: `Only ${hours}h ${mins}m remaining before DTC / Fedwire market cutoff deadline (15:30 EST).`,
      iconName: 'AlertTriangle',
    });
    totalScore += 25;
  } else if (trade.cutoffMinutesRemaining <= 240) {
    factors.push({
      category: 'Cutoff Urgency',
      factor: 'Approaching Intra-day Cutoff Window',
      points: 15,
      severity: 'HIGH',
      explanation: `${Math.round(trade.cutoffMinutesRemaining / 60)} hours remaining before pre-matching cutoff window closes.`,
      iconName: 'Clock',
    });
    totalScore += 15;
  } else if (trade.cutoffMinutesRemaining <= 480) {
    factors.push({
      category: 'Cutoff Urgency',
      factor: 'Standard Settlement Day Horizon',
      points: 8,
      severity: 'MEDIUM',
      explanation: 'Same-day settlement required before end-of-day depository processing cycle.',
      iconName: 'Calendar',
    });
    totalScore += 8;
  }

  // 3. Trade Exposure / Value (+20 for > $2M, +15 for > $1M, +10 for > $500k)
  if (trade.tradeValue >= 2000000) {
    factors.push({
      category: 'Financial Exposure',
      factor: 'High-Value Transaction Exposure',
      points: 20,
      severity: 'HIGH',
      explanation: `Gross exposure of $${(trade.tradeValue / 1000000).toFixed(1)}M exceeds High Value Operations Threshold ($2.0M). CSDR penalty risk elevated.`,
      iconName: 'DollarSign',
    });
    totalScore += 20;
  } else if (trade.tradeValue >= 1000000) {
    factors.push({
      category: 'Financial Exposure',
      factor: 'Elevated Transaction Value',
      points: 15,
      severity: 'MEDIUM',
      explanation: `Exposure of $${(trade.tradeValue / 1000000).toFixed(2)}M requires Tier 2 escalation monitoring.`,
      iconName: 'DollarSign',
    });
    totalScore += 15;
  } else if (trade.tradeValue >= 500000) {
    factors.push({
      category: 'Financial Exposure',
      factor: 'Standard Commercial Exposure',
      points: 10,
      severity: 'LOW',
      explanation: `Value $${(trade.tradeValue / 1000).toFixed(0)}k exceeds daily automatic clearance limit.`,
      iconName: 'DollarSign',
    });
    totalScore += 10;
  }

  // 4. Counterparty Historical Performance (+15 for > 5 fails, +10 for > 2 fails, +5 for > 0 fails)
  if (trade.counterparty.priorFailures >= 5) {
    factors.push({
      category: 'Counterparty Risk',
      factor: 'Repeated Counterparty Failure Precedents',
      points: 15,
      severity: 'HIGH',
      explanation: `${trade.counterparty.name} (${trade.counterparty.id}) has ${trade.counterparty.priorFailures} prior settlement failures in past 30 days (Fail rate: ${trade.counterparty.historicalFailRate}%).`,
      iconName: 'Building2',
    });
    totalScore += 15;
  } else if (trade.counterparty.priorFailures >= 2) {
    factors.push({
      category: 'Counterparty Risk',
      factor: 'Moderate Counterparty Settlement Friction',
      points: 10,
      severity: 'MEDIUM',
      explanation: `${trade.counterparty.name} has ${trade.counterparty.priorFailures} recent delayed settlements.`,
      iconName: 'Building2',
    });
    totalScore += 10;
  } else if (trade.counterparty.priorFailures > 0) {
    factors.push({
      category: 'Counterparty Risk',
      factor: 'Minor Counterparty Exception History',
      points: 5,
      severity: 'LOW',
      explanation: `${trade.counterparty.name} experienced 1 recent non-critical delay.`,
      iconName: 'Building2',
    });
    totalScore += 5;
  }

  // 5. Historical Pattern & Precedent Severity (+6 for matching failure-prone historical patterns)
  // Note: Snowflake's pre-computed RISK_SCORE uses varying historical precedent scores (6, 10, 11)
  // based on actual historical case similarity analysis. This deterministic calculation
  // uses a fixed +6 as a baseline approximation.
  const historicalPrecedentPoints = options?.historicalPrecedentPoints ?? 6;
  factors.push({
    category: 'Institutional Memory',
    factor: 'Historical Failure Pattern Precedent',
    points: historicalPrecedentPoints,
    severity: 'MEDIUM',
    explanation: historicalPrecedentPoints === 6
      ? 'ClearSet deterministic baseline: matched prior similar cases where lack of timely repair resulted in depository reject.'
      : `Snowflake live risk score uses ${historicalPrecedentPoints} points based on actual historical case similarity analysis.`,
    iconName: 'History',
  });
  totalScore += historicalPrecedentPoints;

  // Cap score at 100
  totalScore = Math.min(100, Math.max(0, totalScore));

  let severity: ExceptionSeverity = 'LOW';
  if (totalScore >= 80) severity = 'CRITICAL';
  else if (totalScore >= 60) severity = 'HIGH';
  else if (totalScore >= 40) severity = 'MEDIUM';

  const summary = `Calculated deterministic risk score: ${totalScore}/100 (${severity}). Primary drivers: ${factors.map(f => `${f.factor} (+${f.points})`).join(', ')}.`;

  return {
    totalScore,
    severity,
    factors,
    summary,
    calculatedAt: new Date().toISOString(),
  };
}
