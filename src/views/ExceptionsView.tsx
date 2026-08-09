import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  Sparkles, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';

export const ExceptionsView: React.FC = () => {
  const { exceptions, selectExceptionForInvestigation, searchQuery, setSearchQuery } = useApp();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('ALL');

  const filteredExceptions = exceptions.filter((ex) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = ex.tradeId.toLowerCase().includes(q);
      const matchTicker = ex.trade.security.ticker.toLowerCase().includes(q);
      const matchIsin = ex.trade.security.isin.toLowerCase().includes(q);
      const matchCp = ex.trade.counterparty.name.toLowerCase().includes(q) || ex.trade.counterparty.id.toLowerCase().includes(q);
      if (!matchId && !matchTicker && !matchIsin && !matchCp) return false;
    }

    // Severity filter
    if (selectedSeverity !== 'ALL' && ex.severity !== selectedSeverity) return false;

    // Asset class filter
    if (selectedAssetClass !== 'ALL' && ex.trade.security.assetClass !== selectedAssetClass) return false;

    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Settlement Exception Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Showing {filteredExceptions.length} of {exceptions.length} detected exceptions in firm queue
          </p>
        </div>

        {/* Quick batch CTA */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => selectExceptionForInvestigation('TRD-92831')}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Investigate TRD-92831 (Highest Risk)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
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

        {/* Filter Controls */}
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

          {/* Asset Class */}
          <div className="flex items-center space-x-1 bg-[#162032] border border-slate-700 rounded-lg p-1 text-xs">
            <span className="text-slate-400 px-2 font-mono text-[11px]">Asset:</span>
            {['ALL', 'Equities', 'Fixed Income'].map((ac) => (
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
        </div>
      </div>

      {/* Exception Table */}
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#162032] text-slate-300 font-mono text-[11px] uppercase border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Trade ID / Asset</th>
                <th className="py-3 px-4">Counterparty</th>
                <th className="py-3 px-4">Trade Value</th>
                <th className="py-3 px-4">Cutoff Countdown</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Primary Exception Driver</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExceptions.map((ex) => {
                const isShowcase = ex.tradeId === 'TRD-92831';

                return (
                  <tr
                    key={ex.id}
                    onClick={() => selectExceptionForInvestigation(ex.tradeId)}
                    className={`hover:bg-[#162032] transition-colors cursor-pointer ${
                      isShowcase ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    {/* Trade ID & Ticker */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-xs">
                          {ex.tradeId}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#162032] text-slate-200 font-semibold text-[10px] border border-slate-700">
                          {ex.trade.security.ticker}
                        </span>
                        {isShowcase && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] border border-cyan-500/30">
                            SHOWCASE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {ex.trade.security.isin} • {ex.trade.security.depository}
                      </div>
                    </td>

                    {/* Counterparty */}
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                      ${ex.trade.tradeValue.toLocaleString()}
                    </td>

                    {/* Cutoff */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <Clock className={`w-3.5 h-3.5 ${ex.trade.cutoffMinutesRemaining < 120 ? 'text-rose-400' : 'text-amber-400'}`} />
                        <span className={ex.trade.cutoffMinutesRemaining < 120 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {Math.floor(ex.trade.cutoffMinutesRemaining / 60)}h {ex.trade.cutoffMinutesRemaining % 60}m
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {ex.trade.cutoffTime}
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                            ex.riskScore.totalScore >= 80
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : ex.riskScore.totalScore >= 60
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {ex.riskScore.totalScore}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {ex.severity}
                        </span>
                      </div>
                    </td>

                    {/* Driver */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="text-xs font-medium text-slate-200 font-sans">
                        {ex.riskScore.factors[0]?.factor || ex.exceptionType}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        +{ex.riskScore.factors[0]?.points} points weight
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          ex.status === 'RESOLVED'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : ex.status === 'INVESTIGATING' || ex.status === 'PENDING_APPROVAL'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {ex.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectExceptionForInvestigation(ex.tradeId);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-blue-600 hover:text-white border border-slate-700 text-slate-200 text-xs font-bold transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
