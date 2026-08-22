import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CaseRecord, CopilotMessage, ExceptionItem, InvestigationStep, SettlementEvent, SettlementInstruction } from '../types';
import type { DashboardStats } from '../services/types';
import { settlementService } from '../services/settlementService';
import { cortexService } from '../services/cortexService';
import { INITIAL_CASES } from '../data/syntheticData';
import { fetchHealth } from '../services/apiClient';
import confetti from 'canvas-confetti';

export type EvidenceTabType = 'trade' | 'settlement' | 'counterparty' | 'history' | 'policy';

/** Whether the backend is connected to live Snowflake. */
export type BackendMode = 'checking' | 'live' | 'local';

interface AppContextType {
  exceptions: ExceptionItem[];
  cases: CaseRecord[];
  activeExceptionId: string | null;
  activeException: ExceptionItem | null;
  investigationSteps: InvestigationStep[];
  isInvestigating: boolean;
  activeStepIndex: number;
  activeEvidenceTab: EvidenceTabType;
  setActiveEvidenceTab: (tab: EvidenceTabType) => void;
  copilotMessages: CopilotMessage[];
  dashboardMetrics: DashboardStats;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectExceptionForInvestigation: (tradeId: string, evidenceTab?: EvidenceTabType) => void;
  startInvestigation: (tradeId: string) => void;
  approveAction: (tradeId: string, customNotes?: string) => void;
  rejectAction: (tradeId: string, reason?: string) => void;
  sendCopilotMessage: (text: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** Live settlement events for the currently active trade (from Snowflake or local fallback). */
  activeSettlementEvents: SettlementEvent[];
  /** Live SSI record for the currently active trade (from service layer, local fallback if unavailable). */
  activeSettlementInstruction: SettlementInstruction | null;
  /** Backend/Snowflake connection status, driven by GET /api/health. */
  backendMode: BackendMode;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>(INITIAL_CASES);
  const [activeExceptionId, setActiveExceptionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<EvidenceTabType>('policy');
  const [investigationSteps, setInvestigationSteps] = useState<InvestigationStep[]>(cortexService.getInvestigationSteps());
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live data for the active trade's evidence tabs
  const [activeSettlementEvents, setActiveSettlementEvents] = useState<SettlementEvent[]>([]);
  const [activeSettlementInstruction, setActiveSettlementInstruction] = useState<SettlementInstruction | null>(null);

  // Backend/Snowflake connection status — single source of truth for the whole app.
  // Navbar uses its own fetchHealth() call; this one drives CopilotView and any other consumer.
  const [backendMode, setBackendMode] = useState<BackendMode>('checking');

  // Check health once on mount
  useEffect(() => {
    let cancelled = false;
    fetchHealth(6000).then((health) => {
      if (!cancelled) {
        setBackendMode(health.snowflake === true ? 'live' : 'local');
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Initial load of exceptions from settlementService (Snowflake → local fallback)
  useEffect(() => {
    settlementService.getExceptions().then((data) => {
      setExceptions(data);
    });
  }, []);

  // When the active trade changes, load its settlement events and SSI via the service layer.
  // HybridSettlementService will try the live endpoint first, then fall back to local data.
  useEffect(() => {
    if (!activeExceptionId) return;
    let cancelled = false;

    settlementService.getSettlementEvents(activeExceptionId).then((events) => {
      if (!cancelled) setActiveSettlementEvents(events);
    });

    settlementService.getSettlementInstruction(activeExceptionId).then((ssi) => {
      if (!cancelled) setActiveSettlementInstruction(ssi);
    });

    return () => { cancelled = true; };
  }, [activeExceptionId]);

  // Compute dynamic dashboard metrics from active state
  const dashboardMetrics = settlementService.getDashboardMetrics(exceptions, cases);

  // Initial Copilot messages with clear domain orientation
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      timestamp: '12:00:15',
      text: 'Good afternoon. I am **ClearSet AI**, your post-trade operations copilot for settlement exception resolution. I am monitoring institutional settlement flows across DTC, Fedwire, and Euroclear.',
      suggestedFollowUps: [
        'Show me critical settlement exceptions approaching cutoff.',
        'What should I do according to our SOP?',
        'Have we seen this counterparty fail before?',
      ],
    },
  ]);

  const activeException = exceptions.find((ex) => ex.tradeId === activeExceptionId) || exceptions[0] || null;

  const selectExceptionForInvestigation = (tradeId: string, evidenceTab?: EvidenceTabType) => {
    setActiveExceptionId(tradeId);
    setActiveTab('investigation');
    if (evidenceTab) {
      setActiveEvidenceTab(evidenceTab);
    }
    setInvestigationSteps(cortexService.getInvestigationSteps());
    setIsInvestigating(false);
    setActiveStepIndex(0);
  };

  const startInvestigation = (tradeId: string) => {
    const targetEx = exceptions.find((ex) => ex.tradeId === tradeId);
    if (!targetEx) return;

    setIsInvestigating(true);
    const initial = cortexService.getInvestigationSteps();
    setInvestigationSteps(initial);

    // Procedural execution runner
    let currentStep = 0;
    const interval = setInterval(async () => {
      if (currentStep < 10) {
        const stepNum = currentStep + 1;
        const stepDetails = await cortexService.executeStep(stepNum, targetEx.trade);

        setInvestigationSteps((prev) =>
          prev.map((step, idx) => {
            if (idx === currentStep) {
              return {
                ...step,
                status: 'COMPLETED',
                logs: stepDetails.logs,
                outputSummary: stepDetails.summary,
              };
            }
            if (idx === currentStep + 1 && currentStep + 1 < 10) {
              return { ...step, status: 'RUNNING' };
            }
            return step;
          })
        );
        setActiveStepIndex(currentStep + 1);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsInvestigating(false);

        // Update status to PENDING_APPROVAL
        setExceptions((prev) =>
          prev.map((ex) =>
            ex.tradeId === tradeId ? { ...ex, status: 'PENDING_APPROVAL' } : ex
          )
        );
      }
    }, 650);
  };

  const approveAction = async (tradeId: string, customNotes?: string) => {
    const ex = exceptions.find((e) => e.tradeId === tradeId);
    if (!ex) return;

    const newCaseId = `INV-2026-009${Math.floor(30 + Math.random() * 60)}`;
    const recommendation = await cortexService.generateRecommendation(ex.trade);

    const newCase: CaseRecord = {
      caseId: newCaseId,
      tradeId: ex.tradeId,
      tradeValue: ex.trade.tradeValue,
      riskScore: ex.riskScore.totalScore,
      severity: ex.severity,
      rootCause: recommendation.rootCause.primary,
      aiRecommendation: recommendation.primaryAction,
      humanDecision: 'APPROVED',
      approvedBy: 'Alex Mercer (Operations Analyst)',
      approvedAt: new Date().toISOString(),
      executionStatus: 'IN_PROGRESS',
      resolutionOutcome: `SWIFT MT599 repair message dispatched to ${ex.trade.counterparty.name} (${ex.trade.counterparty.bic}). Desk escalation logged.`,
      createdAt: new Date().toISOString(),
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          action: 'INVESTIGATION_COMPLETED',
          actor: 'CLEARSET_AGENT',
          details: `Autonomous investigation completed. Deterministic risk score ${ex.riskScore.totalScore}/100.`,
        },
        {
          timestamp: new Date().toISOString(),
          action: 'HUMAN_APPROVAL_GRANTED',
          actor: 'ANALYST',
          details: customNotes || `Analyst approved recommended SWIFT repair & Ops Lead escalation for ${ex.trade.counterparty.name}.`,
        },
        {
          timestamp: new Date().toISOString(),
          action: 'SWIFT_DISPATCH_TRIGGERED',
          actor: 'SYSTEM',
          details: `Dispatched MT599 to BIC ${ex.trade.counterparty.bic} (Ref: ${newCaseId}).`,
        },
      ],
    };

    setCases((prev) => [newCase, ...prev]);

    setExceptions((prev) =>
      prev.map((item) =>
        item.tradeId === tradeId ? { ...item, status: 'RESOLVED', caseId: newCaseId } : item
      )
    );

    await settlementService.resolveException(tradeId, newCase);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00E5FF', '#00E676', '#6366F1'],
      });
    } catch {
      // ignore
    }
  };

  const rejectAction = (tradeId: string, _reason?: string) => {
    setExceptions((prev) =>
      prev.map((item) =>
        item.tradeId === tradeId ? { ...item, status: 'OPEN' } : item
      )
    );
  };

  const sendCopilotMessage = async (text: string) => {
    const userMsgId = `msg-user-${Date.now()}`;
    const userMsg: CopilotMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
    };

    setCopilotMessages((prev) => [...prev, userMsg]);

    const activeTrade = activeException?.trade;
    const response = await cortexService.queryCopilot(text, activeTrade);

    setTimeout(() => {
      // If user prompted to investigate, trigger investigation automatically
      if (response.structuredData?.type === 'investigation_launch') {
        const tradeId = response.structuredData.tradeId;
        if (tradeId) {
          selectExceptionForInvestigation(tradeId);
          startInvestigation(tradeId);
        }
      }

      const botReply: CopilotMessage = {
        id: `msg-bot-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: response.text,
        structuredData: response.structuredData,
        suggestedFollowUps: response.suggestedFollowUps,
      };

      setCopilotMessages((prev) => [...prev, botReply]);
    }, 450);
  };

  return (
    <AppContext.Provider
      value={{
        exceptions,
        cases,
        activeExceptionId,
        activeException,
        investigationSteps,
        isInvestigating,
        activeStepIndex,
        activeEvidenceTab,
        setActiveEvidenceTab,
        copilotMessages,
        dashboardMetrics,
        activeTab,
        setActiveTab,
        selectExceptionForInvestigation,
        startInvestigation,
        approveAction,
        rejectAction,
        sendCopilotMessage,
        searchQuery,
        setSearchQuery,
        activeSettlementEvents,
        activeSettlementInstruction,
        backendMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
