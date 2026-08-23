import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Sparkles,
  Clock,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import {
  ProvenanceTag,
  EmptyState,
} from '../components/ui/primitives';
import {
  SEVERITY_COLORS,
  formatCutoffRemaining,
} from '../components/ui/tokens';

type SortKey = 'risk' | 'cutoff' | 'value';
type Density = 'comfortable' | 'compact';

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const ExceptionsView: React.FC = () => {
  const { exceptions, activeExceptionId, selectExceptionForInvestigation, searchQuery, setSearchQuery } = useApp();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [density, setDensity] = useState<Density>('comfortable');

  // Filter option lists derived from live data — never hardcoded.
  const assetClassOptions = useMemo(
    () => Array.from(new Set(exceptions.map((ex) => ex.trade.security.assetClass))).sort(),
    [exceptions]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(exceptions.map((ex) => ex.exceptionType))).sort(),
    [exceptions]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(exceptions.map((ex) => ex.status))),
    [exceptions]
  );

  const filteredExceptions = useMemo(() => {
    const filtered = exceptions.filter((ex) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = ex.tradeId.toLowerCase().includes(q);
        const matchTicker = ex.trade.security.ticker.toLowerCase().includes(q);
        const matchIsin = ex.trade.security.isin.toLowerCase().includes(q);
        const matchCp = ex.trade.counterparty.name.toLowerCase().includes(q) || ex.trade.counterparty.id.toLowerCase().includes(q);
        if (!matchId && !matchTicker && !matchIsin && !matchCp) return false;
      }

      if (selectedSeverity !== 'ALL' && ex.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'ALL' && ex.status !== selectedStatus) return false;
      if (selectedAssetClass !== 'ALL' && ex.trade.security.assetClass !== selectedAssetClass) return false;
      if (selectedType !== 'ALL' && ex.exceptionType !== selectedType) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'cutoff':
          return a.trade.cutoffMinutesRemaining - b.trade.cutoffMinutesRemaining;
        case 'value':
          return b.trade.tradeValue - a.trade.tradeValue;
        case 'risk':
        default: {
          const sevDiff =
            (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
          return sevDiff !== 0
            ? sevDiff
            : b.riskScore.totalScore - a.riskScore.totalScore;
        }
      }
    });
  }, [exceptions, searchQuery, selectedSeverity, selectedStatus, selectedAssetClass, selectedType, sortKey]);

  const openExceptions = exceptions.filter((ex) => ex.status !== 'RESOLVED');
  const topRiskException = [...openExceptions].sort(
    (a, b) => b.riskScore.totalScore - a.riskScore.totalScore
  )[0];

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Settlement Exception Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-2 flex-wrap">
            <span>
              Showing {filteredExceptions.length} of {exceptions.length} detected exceptions ({openExceptions.length} unresolved)
            </span>
            <ProvenanceTag kind="live" />
          </p>
        </div>

        {/* Quick batch CTA */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => topRiskException ? selectExceptionForInvestigation(topRiskException.tradeId) : undefined}
            disabled={!topRiskException}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl ${topRiskException
              ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white shadow-md shadow-cyan-500/20'
              : 'bg-[#162032] text-slate-500 cursor-not-allowed'} text-xs font-bold transition-all`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{topRiskException ? `Investigate ${topRiskException.tradeId} (Highest Risk)` : 'No Exceptions to Investigate'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Trade ID, ISIN, Counterparty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
            />
          </div>

          {/* Sort & Density Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-[#162032] border border-slate-700 rounded-lg p-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
              {([
                { key: 'risk' as SortKey, label: 'Risk' },
                { key: 'cutoff' as SortKey, label: 'Cutoff' },
                { key: 'value' as SortKey, label: 'Value' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    sortKey === opt.key
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-[#162032] border border-slate-700 rounded-lg p-0.5 text-xs">
              {(['comfortable', 'compact'] as Density[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize transition-all ${
                    density === d ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Severity */}
          <div className="flex items-center space-x-1 bg-[#162032] border border-slate-700 rounded-lg p-1 text-xs">
            <span className="text-slate-400 px-2 font-mono text-[11px]">Severity:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedSeverity === sev
                    ? sev === 'CRITICAL'
                      ? 'bg-rose-500/25 text-rose-300 font-bold border border-rose-500/40'
                      : sev === 'HIGH'
                      ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                      : 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status — options from live data */}
          <div className="flex items-center space-x-1 bg-[#162032] border border-slate-700 rounded-lg p-1 text-xs">
            <span className="text-slate-400 px-2 font-mono text-[11px]">Status:</span>
            {['ALL', ...statusOptions].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedStatus === st
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Asset Class — options from live data */}
          <div className="flex items-center space-x-1 bg-[#162032] border border-slate-700 rounded-lg p-1 text-xs">
            <span className="text-slate-400 px-2 font-mono text-[11px]">Asset:</span>
            {['ALL', ...assetClassOptions].map((ac) => (
              <button
                key={ac}
                onClick={() => setSelectedAssetClass(ac)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedAssetClass === ac
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ac}
              </button>
            ))}
          </div>

          {/* Exception Type — dropdown for the long list */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#162032] border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Exception Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exception Table */}
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#162032] text-slate-300 font-mono text-[11px] uppercase border-b border-slate-700">
              <tr>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Trade ID / Asset</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Counterparty</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Trade Value</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Cutoff Countdown</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Risk Score</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Exception Type</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Primary Driver</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>Status</th>
                <th className={`px-4 ${density === 'compact' ? 'py-2' : 'py-3'} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExceptions.map((ex) => {
                const isTopRisk = ex.tradeId === topRiskException?.tradeId;
                const isSelected = activeExceptionId === ex.tradeId;
                const sevColor = SEVERITY_COLORS[ex.severity] ?? '#64748B';
                const score = ex.riskScore.totalScore;
                const scoreBand =
                  score >= 80
                    ? 'bg-rose-500'
                    : score >= 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <tr
                    key={ex.id}
                    onClick={() => selectExceptionForInvestigation(ex.tradeId)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/30 ring-1 ring-inset ring-cyan-500/40'
                        : isTopRisk
                        ? 'bg-rose-950/20 hover:bg-[#162032]'
                        : 'hover:bg-[#162032]'
                    }`}
                  >
                    {/* Trade ID & Ticker — severity accent lives on this leading edge */}
                    <td className={cellPad} style={{ borderLeft: `3px solid ${sevColor}` }}>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-xs">
                          {ex.tradeId}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#162032] text-slate-200 font-semibold text-[10px] border border-slate-700">
                          {ex.trade.security.ticker}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {ex.trade.security.isin} • {ex.trade.security.depository}
                      </div>
                    </td>

                    {/* Counterparty */}
                    <td className={cellPad}>
                      <div className="text-slate-200 font-medium font-sans">{ex.trade.counterparty.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <span>{ex.trade.counterparty.id}</span>
                        <span>•</span>
                        <span className={ex.trade.counterparty.priorFailures > 4 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                          {ex.trade.counterparty.priorFailures} prior fails
                        </span>
                      </div>
                    </td>

                    {/* Value */}
                    <td className={`${cellPad} font-mono font-bold text-slate-100`}>
                      ${ex.trade.tradeValue.toLocaleString()}
                    </td>

                    {/* Cutoff */}
                    <td className={cellPad}>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <Clock className={`w-3.5 h-3.5 ${ex.trade.cutoffMinutesRemaining <= 0 ? 'text-rose-500' : ex.trade.cutoffMinutesRemaining < 120 ? 'text-rose-400' : 'text-amber-400'}`} />
                        <span className={ex.trade.cutoffMinutesRemaining <= 0 ? 'text-rose-400 font-bold' : ex.trade.cutoffMinutesRemaining < 120 ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                          {formatCutoffRemaining(ex.trade.cutoffMinutesRemaining)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {ex.trade.cutoffTime}
                      </div>
                    </td>

                    {/* Risk Score — chip + proportional mini-bar (COMPUTED from deterministic engine) */}
                    <td className={cellPad}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                            score >= 80
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                              : score >= 60
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {score}
                        </span>
                        <div className="flex flex-col gap-1">
                          <div className="w-16 h-1 rounded-full bg-slate-800 overflow-hidden" title={`Risk score ${score}/100 (COMPUTED)`}>
                            <div className={`h-full rounded-full ${scoreBand}`} style={{ width: `${score}%` }} />
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">{ex.severity}</span>
                        </div>
                      </div>
                    </td>

                    {/* Exception Type */}
                    <td className={cellPad}>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        {ex.exceptionType}
                      </span>
                    </td>

                    {/* Driver */}
                    <td className={`${cellPad} text-slate-300`}>
                      <div className="text-xs font-medium text-slate-200 font-sans">
                        {ex.riskScore.factors[0]?.factor || '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ex.riskScore.factors[0] ? `+${ex.riskScore.factors[0].points} points weight` : 'no scored factors'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className={cellPad}>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          ex.status === 'RESOLVED'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : ex.status === 'ESCALATED'
                            ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                            : ex.status === 'INVESTIGATING' || ex.status === 'PENDING_APPROVAL'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {ex.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className={`${cellPad} text-right`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectExceptionForInvestigation(ex.tradeId);
                        }}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                          isTopRisk || isSelected
                            ? 'bg-blue-600 hover:bg-blue-500 border-transparent text-white shadow-sm'
                            : 'bg-[#162032] hover:bg-blue-600 hover:text-white hover:border-transparent border-slate-700 text-slate-200'
                        }`}
                      >
                        <Sparkles className={`w-3 h-3 ${isTopRisk || isSelected ? 'text-cyan-200' : 'text-cyan-400'}`} />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredExceptions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 px-4">
                    <EmptyState message="No exceptions match the current filters. Adjust the severity, status, or asset filters — or clear the search query." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
