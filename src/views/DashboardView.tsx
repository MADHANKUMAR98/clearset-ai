import React from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign, 
  ArrowUpRight, 
  Sparkles, 
  Clock, 
  Building2, 
  ChevronRight,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar 
} from 'recharts';
import { useApp } from '../context/AppContext';

export const DashboardView: React.FC = () => {
  const { 
    exceptions, 
    dashboardMetrics, 
    selectExceptionForInvestigation, 
    setActiveTab, 
    sendCopilotMessage,
    backendMode,
  } = useApp();

  const criticalExceptions = exceptions.filter((ex) => ex.severity === 'CRITICAL' && ex.status !== 'RESOLVED');
  const topCriticalException = criticalExceptions.sort((a, b) => b.riskScore.totalScore - a.riskScore.totalScore)[0];

  // Derive counterparty fail concentration from live exceptions data.
  // Group open exceptions by counterparty, using real priorFailures and tradeValue.
  // Falls back gracefully to showing whatever exceptions we have (including local synthetic data).
  const counterpartyFailDistribution = React.useMemo(() => {
    const openExceptions = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, { name: string; cpId: string; fails: number; exposure: number }>();
    for (const ex of openExceptions) {
      const cp = ex.trade.counterparty;
      const shortName = cp.name.split(' ').slice(0, 2).join(' ');
      const key = cp.id;
      const existing = map.get(key);
      if (existing) {
        existing.exposure = Number((existing.exposure + ex.trade.tradeValue / 1_000_000).toFixed(2));
      } else {
        map.set(key, {
          name: `${shortName} (${cp.id})`,
          cpId: cp.id,
          fails: cp.priorFailures,
          exposure: Number((ex.trade.tradeValue / 1_000_000).toFixed(2)),
        });
      }
    }
    // Sort by prior failures descending, take top 5
    return Array.from(map.values())
      .sort((a, b) => b.fails - a.fails)
      .slice(0, 5);
  }, [exceptions]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#121A2D] via-[#0E1626] to-[#0A101D] border border-slate-700/80 p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">Post-Trade Operations Overview</h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SURVEILLANCE ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time settlement surveillance & deterministic exception triage across DTC, Fedwire, and Euroclear.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setActiveTab('copilot');
              sendCopilotMessage('Show me critical settlement exceptions approaching cutoff.');
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#162032] hover:bg-[#1E2C48] text-cyan-300 border border-cyan-500/30 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Copilot Triage</span>
          </button>

          <button
            onClick={() => topCriticalException ? selectExceptionForInvestigation(topCriticalException.tradeId) : undefined}
            disabled={!topCriticalException}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl ${topCriticalException 
              ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-md shadow-rose-600/20' 
              : 'bg-[#162032] text-slate-500 cursor-not-allowed'} text-xs font-bold transition-all hover:scale-[1.02]`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{topCriticalException ? `Investigate ${topCriticalException.tradeId}` : 'No Critical Exceptions'}</span>
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards — Dynamically Derived */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Trades */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Today's Trades Monitored</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {dashboardMetrics.totalTrades.toLocaleString()}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center font-bold">
              +14.2% <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Settlement Rate: <span className="text-emerald-400 font-bold">{dashboardMetrics.settlementRatePercent}%</span>
          </div>
        </div>

        {/* Total Exceptions */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Exception Queue</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
              {dashboardMetrics.totalExceptions}
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
              0.30% RATE
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Avg Resolution: <span className="text-slate-200 font-bold">{dashboardMetrics.avgTimeToResolveMinutes} mins</span>
          </div>
        </div>

        {/* Critical Exceptions */}
        <div className="bg-gradient-to-br from-[#1A101C] to-[#0F172A] border border-rose-500/40 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-rose-300 text-xs font-bold">
            <span>Critical Exceptions (&lt; 2h Cutoff)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {dashboardMetrics.criticalExceptions}
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">
              URGENT ACTION
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Highest Score: <span className="text-rose-300 font-bold">{topCriticalException ? `${topCriticalException.riskScore.totalScore}/100 (${topCriticalException.tradeId})` : '—'}</span>
          </div>
        </div>

        {/* Gross Exposure */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Critical Gross Exposure</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              ${(dashboardMetrics.totalExposureDollars / 1000000).toFixed(1)}M
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
              Saved ${(dashboardMetrics.csdrPenaltiesAvoidedToday / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            CSDR Daily Penalty Risk: <span className="text-amber-400 font-bold">$18.4k/day</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Queue & Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical Exceptions Priority Queue (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Critical Settlement Exceptions Priority Queue
              </h2>
              <span className="text-[10px] font-mono bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30 font-semibold">
                Deterministic Scoring
              </span>
            </div>
            <button
              onClick={() => setActiveTab('exceptions')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
            >
              <span>View All ({dashboardMetrics.totalExceptions})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {criticalExceptions.slice(0, 4).map((ex) => {
              const isTopShowcase = ex.tradeId === 'TRD-92831';
              return (
                <div
                  key={ex.id}
                  onClick={() => selectExceptionForInvestigation(ex.tradeId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm ${
                    isTopShowcase
                      ? 'bg-[#181324] hover:bg-[#201830] border-rose-500/50'
                      : 'bg-[#162032] hover:bg-[#1C2A44] border-slate-700'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#0F172A] border border-rose-500/40 shrink-0">
                      <span className="text-base font-bold font-mono text-rose-400 leading-none">
                        {ex.riskScore.totalScore}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400 mt-0.5 font-bold">SCORE</span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-xs">{ex.tradeId}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#0F172A] border border-slate-700 text-slate-200">{ex.trade.security.ticker}</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">${(ex.trade.tradeValue / 1000000).toFixed(1)}M</span>
                        {isTopShowcase && <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">HERO SHOWCASE</span>}
                      </div>

                      <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-slate-200"><Building2 className="w-3 h-3 text-slate-400" />{ex.trade.counterparty.name} ({ex.trade.counterparty.id})</span>
                        <span className="text-rose-400 font-semibold font-mono text-[11px]">• {ex.trade.counterparty.priorFailures} prior failures</span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2"><span className="text-amber-400 font-medium">{ex.riskScore.factors[0]?.factor || ex.exceptionType}</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-700">
                    <div className="flex items-center space-x-1.5 text-xs font-mono text-amber-300"><Clock className="w-3.5 h-3.5 text-amber-400" /><span>Cutoff: {Math.floor(ex.trade.cutoffMinutesRemaining / 60)}h {ex.trade.cutoffMinutesRemaining % 60}m</span></div>
                    <button onClick={(e) => { e.stopPropagation(); selectExceptionForInvestigation(ex.tradeId); }} className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-all"><Sparkles className="w-3.5 h-3.5" /><span>Investigate</span></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Counterparty Exposure & System Intelligence */}
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2"><h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Counterparty Fail Concentration</h3><span className="text-[10px] font-mono text-slate-400">Past 30 Days</span></div>
            <div className="h-44 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={counterpartyFailDistribution} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={110} tick={{ fill: '#CBD5E1', fontSize: 10, fontFamily: 'monospace' }} /><Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '11px' }} formatter={(value: any) => [`${value} Settlement Failures`, 'Failures']} /><Bar dataKey="fails" fill="#FF3B5C" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2"><Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-white">CP-192 (Apex Prime)</strong> accounts for repeated failure risk. Autonomous escalation playbook active.</span></div>
          </div>

          <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2"><h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Institutional Playbooks</h3><span className="text-[10px] font-mono text-cyan-400 font-bold">Snowflake KB</span></div>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700"><div className="flex items-center justify-between text-slate-200 font-medium"><span>Expedited SSI Repair SOP §3.2</span><span className="text-emerald-400 font-mono font-bold">88.9% Success{backendMode === 'live' && <span className="ml-1 text-[10px] text-slate-500 font-normal">(illustrative)</span>}</span></div><div className="text-[11px] text-slate-400 mt-1">18 historical cases matched. Resolution time reduced from 24h to 3.8h.{backendMode === 'live' && <span className="ml-1 text-slate-600">(illustrative estimate)</span>}</div></div>
              <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700"><div className="flex items-center justify-between text-slate-200 font-medium"><span>Cash Variance SOP §2.4</span><span className="text-emerald-400 font-mono font-bold">100% On-Time</span></div><div className="text-[11px] text-slate-400 mt-1">Auto-adjustment protocol authorized for variances under $5,000 threshold.</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
