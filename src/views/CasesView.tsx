import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  FolderArchive,
  History,
  ArrowRight,
  UserCheck,
  Cpu,
  Search,
  ShieldCheck,
  Inbox,
  Loader2
} from 'lucide-react';
import type { CaseRecord } from '../types';
import { fetchCases } from '../services/apiClient';

export const CasesView: React.FC = () => {
  const { cases, exceptions, selectExceptionForInvestigation, backendMode } = useApp();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesSource, setCasesSource] = useState<'live' | 'local'>('local');
  const [liveCases, setLiveCases] = useState<CaseRecord[]>([]);

  // tradeId -> tradeValue lookup so persisted cases show real exposure
  const tradeValueByTradeId = useMemo(() => {
    const map = new Map<string, number>();
    exceptions.forEach((ex) => map.set(ex.tradeId, ex.trade.tradeValue));
    return map;
  }, [exceptions]);

  // Load cases persisted in Snowflake when in live mode.
  // Kept in view-local state and merged below — never discarded.
  useEffect(() => {
    if (backendMode === 'live') {
      let cancelled = false;
      setLoadingCases(true);
      fetchCases(10000)
        .then((response) => {
          if (cancelled) return;
          if (response.success && response.mode === 'snowflake') {
            const loadedCases: CaseRecord[] = response.data.map((c) => ({
              caseId: c.caseId,
              tradeId: c.tradeId,
              tradeValue: tradeValueByTradeId.get(c.tradeId) ?? 0,
              riskScore: c.riskScore,
              severity: c.riskScore >= 80 ? 'CRITICAL' : c.riskScore >= 60 ? 'HIGH' : 'MEDIUM',
              rootCause: c.rootCause,
              aiRecommendation: c.recommendation,
              humanDecision: c.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
              approvedBy: c.approvedBy || 'Unknown',
              approvedAt: c.approvedAt || undefined,
              executionStatus: c.resolutionOutcome ? 'CONFIRMED_SETTLED' : 'IN_PROGRESS',
              resolutionOutcome: c.resolutionOutcome ?? undefined,
              createdAt: c.createdAt,
              auditTrail: [
                { timestamp: c.createdAt, action: 'CASE_CREATED', actor: 'SYSTEM' as const, details: 'Case persisted to Snowflake RESOLUTION_CASES.' },
                ...(c.approvedAt ? [{ timestamp: c.approvedAt, action: 'HUMAN_APPROVAL', actor: 'ANALYST' as const, details: `Approved by ${c.approvedBy || 'analyst'}.` }] : []),
              ],
            }));
            setLiveCases(loadedCases);
            setCasesSource('live');
          } else {
            setLiveCases([]);
            setCasesSource('local');
          }
          setLoadingCases(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLiveCases([]);
          setCasesSource('local');
          setLoadingCases(false);
        });
      return () => { cancelled = true; };
    }
    setLiveCases([]);
    setCasesSource('local');
    return undefined;
  }, [backendMode, tradeValueByTradeId]);

  // Session cases (approved this session) + Snowflake-persisted cases, deduped by caseId.
  const allCases = useMemo(() => {
    const seen = new Set<string>();
    return [...cases, ...liveCases].filter((c) => {
      if (seen.has(c.caseId)) return false;
      seen.add(c.caseId);
      return true;
    });
  }, [cases, liveCases]);

  const filteredCases = useMemo(
    () =>
      allCases.filter((c) => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (
          c.caseId.toLowerCase().includes(q) ||
          c.tradeId.toLowerCase().includes(q) ||
          c.rootCause.toLowerCase().includes(q)
        );
      }),
    [allCases, filterQuery]
  );

  const selectedCase =
    filteredCases.find((c) => c.caseId === selectedCaseId) ?? filteredCases[0] ?? null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
            <FolderArchive className="w-5 h-5 text-indigo-400" />
            Institutional Cases & Memory Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Immutable audit trail of autonomous investigations, human approvals, and operational resolutions ({allCases.length} on record)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-mono bg-[#0F172A] border border-slate-700 px-3 py-1.5 rounded-xl">
            {loadingCases ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : (
              <ShieldCheck className={`w-3.5 h-3.5 ${casesSource === 'live' ? 'text-emerald-400' : 'text-cyan-400'}`} />
            )}
            <span className={`${casesSource === 'live' ? 'text-emerald-400' : 'text-cyan-400'} font-bold`}>
              {loadingCases ? 'LOADING…' : casesSource === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono bg-[#0F172A] border border-slate-700 px-3.5 py-1.5 rounded-xl">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Memory Feed:</span>
            <span className="text-emerald-400 font-bold">{allCases.length} CASES</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Cases List & Selected Case Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cases List (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-lg">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Case ID or Trade ID..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredCases.map((c) => {
              const isSelected = selectedCase?.caseId === c.caseId;
              const valueLabel =
                c.tradeValue > 0 ? `$${(c.tradeValue / 1000000).toFixed(1)}M` : 'VALUE N/A';
              return (
                <div
                  key={c.caseId}
                  onClick={() => setSelectedCaseId(c.caseId)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                    isSelected
                      ? 'bg-[#1C2A44] border-indigo-500/50 shadow-md shadow-indigo-950/30 shadow-[inset_3px_0_0_0_#6366F1]'
                      : 'bg-[#162032] border-slate-700 hover:bg-[#1B273F]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white text-xs">
                        {c.caseId}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F172A] border border-slate-700 text-slate-200">
                        {c.tradeId}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        c.executionStatus === 'CONFIRMED_SETTLED'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {c.executionStatus}
                    </span>
                  </div>

                  <div className="text-xs text-slate-200 mt-2 line-clamp-1 font-medium font-sans">
                    {c.rootCause}
                  </div>

                  <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between font-mono">
                    <span>{valueLabel}</span>
                    <span className="text-rose-400 font-bold">Score: {c.riskScore}</span>
                    <span className="text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}

            {filteredCases.length === 0 && !loadingCases && (
              <div className="py-12 flex flex-col items-center text-center space-y-2 text-slate-400">
                <Inbox className="w-8 h-8 text-slate-600" />
                <div className="text-xs font-mono leading-relaxed">
                  No resolution cases recorded yet.
                  <br />
                  Complete an investigation and approve the recommended action to create the first case.
                </div>
              </div>
            )}

            {loadingCases && filteredCases.length === 0 && (
              <div className="py-12 flex flex-col items-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs font-mono">Loading cases from Snowflake…</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Case Dossier & Audit Trail (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedCase ? (
            <div className="bg-[#0F172A] border border-slate-700/80 p-6 rounded-2xl space-y-5 shadow-lg">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xl font-bold font-mono text-white">
                      {selectedCase.caseId}
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#162032] border border-slate-700 text-slate-200">
                      {selectedCase.tradeId}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Value: {selectedCase.tradeValue > 0 ? `$${(selectedCase.tradeValue / 1000000).toFixed(2)}M` : 'DATA NOT AVAILABLE'} • Risk Score: {selectedCase.riskScore}/100 ({selectedCase.severity})
                  </div>
                </div>

                <button
                  onClick={() => selectExceptionForInvestigation(selectedCase.tradeId)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-blue-600 hover:text-white text-slate-200 text-xs font-bold border border-slate-700 transition-all"
                >
                  <span>Open in Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* AI Recommendation vs Human Decision */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-1.5">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                    AI Root-Cause & Recommendation
                  </span>
                  <div className="font-bold text-slate-100 font-sans">{selectedCase.rootCause}</div>
                  <p className="text-[11px] text-slate-300 font-mono">{selectedCase.aiRecommendation}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#162032] border border-emerald-500/40 space-y-1.5">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    Human Authorization
                  </span>
                  <div className="font-bold text-white font-sans">
                    Decision: <span className="text-emerald-400">{selectedCase.humanDecision}</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Authorized by: {selectedCase.approvedBy || 'Unknown'}
                  </div>
                  {selectedCase.approvedAt && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Timestamp: {new Date(selectedCase.approvedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Operational Outcome */}
              {selectedCase.resolutionOutcome && (
                <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-1 text-xs">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
                    Operational Settlement Outcome
                  </span>
                  <div className="text-slate-200 font-medium font-sans">{selectedCase.resolutionOutcome}</div>
                  {selectedCase.resolutionTimeMinutes && (
                    <div className="text-[11px] text-emerald-300 font-mono mt-1 font-bold">
                      Time to Resolution: {selectedCase.resolutionTimeMinutes} minutes (Under cutoff deadline)
                    </div>
                  )}
                </div>
              )}

              {/* Complete Audit Trail */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  Audit Trail Ledger
                </h3>

                <div className="space-y-2">
                  {selectedCase.auditTrail.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#162032] border border-slate-700/80 text-xs flex items-start justify-between gap-3 font-mono"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-cyan-300 text-[11px]">
                            {entry.action}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0F172A] text-slate-300 border border-slate-700">
                            {entry.actor}
                          </span>
                        </div>
                        <div className="text-slate-300 text-[11px] mt-1 font-sans">
                          {entry.details}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Institutional Memory Feedback Card */}
              <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 flex items-start gap-3 text-xs">
                <History className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white font-sans">
                    Institutional Operational Memory
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    This resolved case outcome is recorded in institutional memory and directly informs future investigation recommendations when similar counterparty exceptions occur.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0F172A] border border-dashed border-slate-700 p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
              <FolderArchive className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-bold text-slate-200">No Case Dossier Available</div>
              <p className="text-xs text-slate-400 max-w-sm font-mono leading-relaxed">
                RESOLUTION_CASES currently contains zero rows in this environment.
                Approve a recommended resolution in the investigation workspace to create the first auditable case record.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
