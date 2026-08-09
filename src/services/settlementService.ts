import type { ISettlementService, DashboardStats } from './types';
import type { 
  Trade, 
  ExceptionItem, 
  SettlementInstruction, 
  SettlementEvent, 
  Counterparty, 
  CaseRecord 
} from '../types';
import { 
  EXCEPTIONS, 
  COUNTERPARTIES, 
  SETTLEMENT_INSTRUCTIONS, 
  SETTLEMENT_EVENTS_TRD92831 
} from '../data/syntheticData';

export class LocalSettlementService implements ISettlementService {
  private exceptions: ExceptionItem[] = [...EXCEPTIONS];

  public async getTrades(): Promise<Trade[]> {
    return this.exceptions.map((e) => e.trade);
  }

  public async getTradeById(tradeId: string): Promise<Trade | null> {
    const ex = this.exceptions.find((e) => e.tradeId === tradeId);
    return ex ? ex.trade : null;
  }

  public async getExceptions(): Promise<ExceptionItem[]> {
    return [...this.exceptions];
  }

  public async getExceptionById(tradeId: string): Promise<ExceptionItem | null> {
    const ex = this.exceptions.find((e) => e.tradeId === tradeId);
    return ex ? { ...ex } : null;
  }

  public async getSettlementInstruction(tradeId: string): Promise<SettlementInstruction | null> {
    const ssi = SETTLEMENT_INSTRUCTIONS[tradeId] || SETTLEMENT_INSTRUCTIONS['TRD-92831'];
    return ssi ? { ...ssi } : null;
  }

  public async getSettlementEvents(tradeId: string): Promise<SettlementEvent[]> {
    if (tradeId === 'TRD-92831') {
      return [...SETTLEMENT_EVENTS_TRD92831];
    }
    return [
      {
        id: `EVT-${tradeId}-1`,
        tradeId,
        timestamp: new Date().toISOString(),
        messageType: 'INTERNAL_ALERT',
        status: 'MONITORING',
        description: `Trade ${tradeId} exception surveillance active.`,
        source: 'CLEARSET_AGENT',
      },
    ];
  }

  public async getCounterparty(cpId: string): Promise<Counterparty | null> {
    const cp = COUNTERPARTIES[cpId];
    return cp ? { ...cp } : null;
  }

  /**
   * Dynamically calculates metrics from active state
   */
  public getDashboardMetrics(currentExceptions: ExceptionItem[], cases: CaseRecord[]): DashboardStats {
    const openExceptions = currentExceptions.filter((e) => e.status !== 'RESOLVED');
    const criticalExceptions = openExceptions.filter((e) => e.severity === 'CRITICAL');
    const highExceptions = openExceptions.filter((e) => e.severity === 'HIGH');
    
    // Sum exposure of active unresolved exceptions
    const activeExposure = openExceptions.reduce((sum, e) => sum + e.trade.tradeValue, 0);

    // Sum penalty avoided from approved cases
    const totalPenaltiesAvoided = 142800 + (cases.length * 1566);

    const totalTrades = 128420;
    const settlementRate = Number(((totalTrades - openExceptions.length) / totalTrades * 100).toFixed(2));

    return {
      totalTrades,
      totalExceptions: openExceptions.length + 376, // Base batch count + dynamic active items
      criticalExceptions: criticalExceptions.length + 39, // Base critical queue + dynamic criticals
      highExceptions: highExceptions.length,
      totalExposureDollars: activeExposure + 72900000, // Dynamic active exposure + baseline firm queue
      settlementRatePercent: settlementRate,
      avgTimeToResolveMinutes: 38,
      csdrPenaltiesAvoidedToday: totalPenaltiesAvoided,
    };
  }

  public async resolveException(tradeId: string, _caseRecord: CaseRecord): Promise<boolean> {
    this.exceptions = this.exceptions.map((e) =>
      e.tradeId === tradeId ? { ...e, status: 'RESOLVED' } : e
    );
    return true;
  }
}

export const settlementService: ISettlementService = new LocalSettlementService();
