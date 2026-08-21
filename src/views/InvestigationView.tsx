import React, { useState } from 'react';
import { useApp, type EvidenceTabType } from '../context/AppContext';
import { 
  Sparkles, 
  ShieldAlert, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  Check, 
  X, 
  Terminal, 
  RefreshCw
} from 'lucide-react';
import { 
  SETTLEMENT_INSTRUCTIONS, 
  HISTORICAL_CASES_TRD92831, 
  HISTORICAL_SUMMARY_TRD92831 
} from '../data/syntheticData';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';

export const InvestigationView: React.FC = () => {
  const { 
    activeException, 
    investigationSteps, 
    isInvestigating, 
    activeEvidenceTab,
    setActiveEvidenceTab,
    startInvestigation, 
    approveAction, 
    rejectAction, 
    setActiveTab,
    activeSettlementEvents,
    activeSettlementInstruction,
  } = useApp();

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [selectedHistoricalCase, setSelectedHistoricalCase] = useState(HISTORICAL_CASES_TRD92831[0]);

  if (!activeException) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        No exception selected. Return to the dashboard or exceptions queue.
      </div>
    );
  }

  const trade = activeException.trade;
  // SSI: use live data from context (loaded via settlementService); fall back to local dict.
  const ssi = activeSettlementInstruction ?? SETTLEMENT_INSTRUCTIONS[trade.id] ?? SETTLEMENT_INSTRUCTIONS['TRD-92831'];
  // Settlement events: use live data from context (fetched via settlementService on trade change).
  const settlementEvents = activeSettlementEvents.length > 0 ? activeSettlementEvents : [];
  const sop = POLICY_DOCUMENTS[0];
  const sopSection = sop.sections[0];

  const hasStarted = investigationSteps.some((s) => s.status !== 'PENDING');

  // Interactive link helper from risk factor to evidence tab
  const handleRiskFactorClick = (category: string) => {
    if (category === 'Instruction Risk') {
      setActiveEvidenceTab('settlement');
    } else if (category === 'Cutoff Urgency') {
      setActiveEvidenceTab('settlement');
    } else if (category === 'Financial Exposure') {
      setActiveEvidenceTab('trade');
    } else if (category === 'Counterparty Risk') {
      setActiveEvidenceTab('counterparty');
    } else if (category === 'Institutional Memory') {
      setActiveEvidenceTab('history');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Showcase Banner */}
      <div className="p-6 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-[#121A2D] via-[#0E1626] to-[#200E19] shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {trade.id}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                CRITICAL EXCEPTION
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Risk Score: {activeException.riskScore.totalScore}/100
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                {trade.security.ticker} ({trade.security.isin})
              </span>
            </div>

            <div className="text-xs text-slate-300 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
              <span className="text-white font-bold text-sm">
                ${(trade.tradeValue / 1000000).toFixed(1)}M {trade.currency}
              </span>
              <span>•</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Settlement Cutoff: {Math.floor(trade.cutoffMinutesRemaining / 60)}h {trade.cutoffMinutesRemaining % 60}m ({trade.cutoffTime})
              </span>
              <span>•</span>
              <span className="text-slate-300">
                Counterparty: <strong className="text-white">{trade.counterparty.name}</strong> ({trade.counterparty.id})
              </span>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex items-center space-x-3">
            {!hasStarted ? (
              <button
                onClick={() => startInvestigation(trade.id)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run AI Investigation</span>
              </button>
            ) : isInvestigating ? (
              <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-950/40 text-cyan-300 border border-cyan-500/40 text-xs font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Executing 10-Step Investigation...</span>
              </div>
            ) : (
              <button
                onClick={() => startInvestigation(trade.id)}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-mono transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Re-run Investigation</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. "WHY?" Deterministic Risk Breakdown Section with Interactive Jump Links */}
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-rose-400 text-base font-black">WHY?</span>
              Deterministic Risk Score Breakdown
            </h2>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              Click factor to inspect evidence ↓
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-500/20 px-3 py-1 rounded-lg border border-rose-500/40 w-fit">
            EXACT SCORE: {activeException.riskScore.totalScore}/100 (CRITICAL)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeException.riskScore.factors.map((factor, index) => (
            <button
              key={index}
              onClick={() => handleRiskFactorClick(factor.category)}
              className="p-3.5 rounded-xl bg-[#162032] hover:bg-[#1C2A44] border border-slate-700 hover:border-cyan-500/60 flex flex-col justify-between space-y-2 text-left transition-all group shadow-sm"
            >
              <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-mono uppercase text-slate-400 group-hover:text-cyan-300 font-semibold">
                  {factor.category}
                </span>
                <span className="font-mono font-bold text-xs text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                  +{factor.points}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-100 group-hover:text-white leading-snug">
                {factor.factor}
              </div>
              <div className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-tight">
                {factor.explanation}
              </div>
              <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 pt-1 opacity-80 group-hover:opacity-100">
                <span>View Evidence</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View: Procedural Stepper (Left) & Evidence / Recommendation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Procedural 10-Step Investigation Stepper (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                10-Step Investigation Workflow
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Autonomous procedural verification sequence
              </p>
            </div>

            {!hasStarted && (
              <button
                onClick={() => startInvestigation(trade.id)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 font-mono"
              >
                <span>Run</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {investigationSteps.map((step) => {
              const isRunning = step.status === 'RUNNING';
              const isCompleted = step.status === 'COMPLETED';

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isRunning
                      ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/40'
                      : isCompleted
                      ? 'bg-[#162032] border-slate-700'
                      : 'bg-[#111827]/60 border-slate-800 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isRunning
                            ? 'bg-cyan-500 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3 h-3 text-emerald-400 font-bold" /> : step.id}
                      </div>
                      <span className={`text-xs font-semibold ${isRunning ? 'text-cyan-300' : isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                        {step.name}
                      </span>
                    </div>

                    <span className="text-[9px] font-mono text-slate-400 uppercase">
                      {step.status}
                    </span>
                  </div>

                  {/* Summary / Logs */}
                  {step.outputSummary && (
                    <div className="mt-2 text-[11px] text-slate-300 pl-8 font-medium">
                      {step.outputSummary}
                    </div>
                  )}

                  {isRunning && (
                    <div className="mt-2 text-[10px] font-mono text-cyan-400 pl-8 flex items-center gap-1.5 animate-pulse">
                      <Terminal className="w-3 h-3" />
                      <span>Verifying telemetry & policy rules...</span>
                    </div>
                  )}

                  {step.logs.length > 0 && (
                    <div className="mt-2 pl-8 space-y-1">
                      {step.logs.slice(0, 2).map((log, lIdx) => (
                        <div key={lIdx} className="text-[9px] font-mono text-slate-400 bg-[#0B0F17] px-2 py-0.5 rounded truncate border border-slate-800">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Evidence Inspector, Root Cause & Recommendation (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Evidence Inspector Tabs */}
          <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Evidence Inspector
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Inspect underlying telemetry, historical cases, and SOP guidance
                </span>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-[#162032] p-1 rounded-lg border border-slate-700">
                {[
                  { id: 'policy' as EvidenceTabType, label: 'Applicable SOP §3.2' },
                  { id: 'history' as EvidenceTabType, label: '18 Similar Cases' },
                  { id: 'counterparty' as EvidenceTabType, label: 'Counterparty (CP-192)' },
                  { id: 'settlement' as EvidenceTabType, label: 'Settlement & SSI' },
                  { id: 'trade' as EvidenceTabType, label: 'Trade Specs' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveEvidenceTab(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      activeEvidenceTab === tab.id
                        ? 'bg-blue-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[220px]">
              {/* Policy Tab */}
              {activeEvidenceTab === 'policy' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-cyan-300">
                        {sop.code}: {sop.title} — Section {sopSection.sectionNumber}
                      </span>
                      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                        BINDING OPERATING STANDARD
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-100">
                      {sopSection.sectionTitle}
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {sopSection.content}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block mb-1">
                        Mandatory Operational Actions
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-300">
                        {sopSection.mandatoryActions.map((act, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] font-mono text-rose-400 uppercase font-bold block mb-1">
                        Escalation Criteria
                      </span>
                      <ul className="space-y-1 text-[11px] text-rose-300">
                        {sopSection.escalationThresholds.map((esc, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{esc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeEvidenceTab === 'history' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#162032] border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white font-mono">{HISTORICAL_SUMMARY_TRD92831.totalFound} Similar Historical Cases Found</span>
                      <div className="text-[11px] text-slate-400">
                        Apex Prime Clearing (CP-192) • Missing SSI • US Equities DVP
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="text-emerald-400 font-bold">12 Corrected (66.7%)</span>
                      <span className="text-amber-400 font-bold">4 Escalated (22.2%)</span>
                      <span className="text-rose-400 font-bold">2 Failed (11.1%)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {HISTORICAL_CASES_TRD92831.slice(0, 3).map((item) => (
                      <div
                        key={item.caseId}
                        onClick={() => setSelectedHistoricalCase(item)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedHistoricalCase.caseId === item.caseId
                            ? 'bg-[#1C2A44] border-cyan-500/50 shadow'
                            : 'bg-[#162032] border-slate-700 hover:bg-[#1B273F]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-200">{item.caseId} ({item.tradeId})</span>
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                            item.outcome === 'RESOLVED_SUCCESS'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : item.outcome === 'ESCALATED'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}>
                            {item.outcome}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1">{item.rootCause}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                          <span>Resolution Time: {item.timeToResolutionHours}h</span>
                          <span className="text-emerald-400 font-bold">Avoided ${item.csdrPenaltyAvoided.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counterparty Tab */}
              {activeEvidenceTab === 'counterparty' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{trade.counterparty.name}</span>
                        <div className="text-[10px] font-mono text-slate-400">
                          BIC: {trade.counterparty.bic} • LEI: {trade.counterparty.lei}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                        Rating: {trade.counterparty.creditRating}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700 text-center font-mono">
                      <div className="p-2 rounded bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">30-Day Fails</span>
                        <span className="text-sm font-bold text-rose-400">{trade.counterparty.priorFailures}</span>
                      </div>
                      <div className="p-2 rounded bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Fail Rate</span>
                        <span className="text-sm font-bold text-rose-400">{trade.counterparty.historicalFailRate}%</span>
                      </div>
                      <div className="p-2 rounded bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Avg Delay</span>
                        <span className="text-sm font-bold text-amber-400">{trade.counterparty.avgResolutionTimeHours}h</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#162032] border border-slate-700">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block mb-1">
                      Desk Contact for Escalation
                    </span>
                    <div className="text-slate-200 font-medium">{trade.counterparty.primaryContact.name} ({trade.counterparty.primaryContact.desk})</div>
                    <div className="text-[11px] text-cyan-400 font-mono">{trade.counterparty.primaryContact.email}</div>
                  </div>
                </div>
              )}

              {/* Settlement & SSI Tab */}
              {activeEvidenceTab === 'settlement' && (
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-bold">Standing Settlement Instruction (SSI)</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                        {ssi.status}
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">
                      {ssi.mismatchDetails}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 pt-2 border-t border-slate-700">
                      <div>Depository: <strong>{ssi.depository}</strong></div>
                      <div>Custodian BIC: <strong>{ssi.custodianBic}</strong></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">SWIFT Event Timeline</span>
                    {settlementEvents.length === 0 ? (
                      <div className="p-2 rounded bg-[#162032] border border-slate-800 text-[10px] text-slate-400 font-mono">
                        No settlement events found for {trade.id}.
                      </div>
                    ) : (
                      settlementEvents.map((evt) => (
                        <div key={evt.id} className="p-2 rounded bg-[#162032] border border-slate-800 text-[10px] flex items-center justify-between">
                          <div>
                            <span className="text-cyan-400 font-bold">{evt.messageType}</span> • <span className="text-slate-200">{evt.description}</span>
                          </div>
                          <span className="text-slate-500 shrink-0 ml-2">{evt.timestamp.includes('T') ? evt.timestamp.split('T')[1].replace('Z', '').slice(0, 8) : evt.timestamp}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Trade Specs Tab */}
              {activeEvidenceTab === 'trade' && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">ISIN</span>
                      <span className="text-slate-100 font-bold">{trade.security.isin}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Depository</span>
                      <span className="text-slate-100 font-bold">{trade.security.depository}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Asset Class</span>
                      <span className="text-slate-100 font-bold">{trade.security.assetClass}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Quantity & Price</span>
                      <span className="text-slate-100 font-bold">{trade.quantity.toLocaleString()} @ ${trade.price.toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Booking Desk</span>
                      <span className="text-slate-100 font-bold">{trade.bookingDesk}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Trader Reference</span>
                      <span className="text-slate-100 font-bold">{trade.traderId}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Root Cause Analysis Card */}
          <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Root-Cause Analysis
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">Synthesized Findings</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
              <div className="text-xs">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-0.5">
                  Primary Failure Cause:
                </span>
                <span className="font-semibold text-rose-300">
                  Missing Standing Settlement Instruction (SSI) for DTC Participant 0244 subaccount.
                </span>
              </div>

              <div className="text-xs pt-2 border-t border-slate-700">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                  Contributing Factors:
                </span>
                <ul className="space-y-1 text-slate-300 text-[11px]">
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Counterparty Apex Prime Clearing (CP-192) has 7 prior settlement failures in past 30 days.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>DTC Cutoff approaching in 1h 42m (15:30 EST).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>High-value exposure of $2.4M exceeding operations threshold.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>18 similar historical cases required early escalation to prevent end-of-day depository reject.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 5. AI Recommendation & Human Approval */}
          <div className="bg-[#0F172A] border border-cyan-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                AI Recommended Resolution Protocol
              </h3>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                SOP §3.2 Aligned
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-white text-sm">
                Request corrected settlement instruction and escalate to Settlement Operations desk.
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-slate-200 font-mono text-[11px]">
                  1. Dispatch automated SWIFT MT599 repair notification to CP-192 Equities Clearing Desk.
                </div>
                <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-slate-200 font-mono text-[11px]">
                  2. Escalate trade TRD-92831 to Settlement Operations Lead (Tier 1 Priority: Cutoff &lt; 120m, Value &gt; $1M).
                </div>
                <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-slate-200 font-mono text-[11px]">
                  3. Continuously monitor depository gateway for DTC Participant 0244 affirmation message.
                </div>
                <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-slate-200 font-mono text-[11px]">
                  4. Reassess deterministic settlement risk score immediately upon receiving confirmed SSI.
                </div>
              </div>
            </div>

            {/* Human in the loop decision bar */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 font-mono">
                  Human Control: AI will not execute SWIFT dispatch without analyst authorization.
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => rejectAction(trade.id, 'Analyst manual override')}
                    className="px-3.5 py-2 rounded-xl bg-[#162032] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold transition-colors"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Dispatch</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Human Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] max-w-lg w-full p-6 rounded-2xl border border-cyan-500/50 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base font-sans">Authorize Operational Resolution</h3>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-1">
                <div className="font-mono text-slate-300">
                  Trade ID: <strong className="text-white">{trade.id}</strong> (${(trade.tradeValue / 1000000).toFixed(1)}M {trade.security.ticker})
                </div>
                <div className="font-mono text-slate-300">
                  Counterparty: <strong className="text-white">{trade.counterparty.name}</strong> ({trade.counterparty.bic})
                </div>
                <div className="font-mono text-emerald-400">
                  Projected CSDR Penalty Avoided: <strong>$1,566.67/day</strong>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Analyst Audit Log Notes:
                </label>
                <textarea
                  rows={3}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Verified with CP-192 desk lead Marcus Vance; authorized automated SWIFT repair under SOP §3.2."
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  approveAction(trade.id, customNote);
                  setShowApprovalModal(false);
                  setActiveTab('cases');
                }}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Create Case</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
