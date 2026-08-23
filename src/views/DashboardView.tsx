import React, { useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  DollarSign,
  Sparkles,
  Clock,
  Building2,
  ChevronRight,
  Zap,
  Database,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  LabelList
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  ProvenanceTag,
  PanelHeader,
  EmptyState,
  SkeletonCard,
} from '../components/ui/primitives';
import {
  SEVERITY_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_STROKE,
  CHART_TICK_STYLE,
  formatCutoffRemaining,
  type ProvenanceKey,
} from '../components/ui/tokens';

const SETTLEMENT_RAIL_COLORS = {
  DTC: '#1E40AF',
  Fedwire: '#059669',
  Euroclear: '#7C3AED',
  Clearstream: '#EA580C',
};

const truncateTick = (label: string) => (label.length > 16 ? `${label.slice(0, 15)}…` : label);

export const DashboardView: React.FC = () => {
  const {
    exceptions,
    dashboardMetrics,
    selectExceptionForInvestigation,
    setActiveTab,
    sendCopilotMessage,
    backendMode,
    lastDataRefreshAt,
    refreshData,
  } = useApp();

  // Initial-load state: no silent zeros — show structural skeletons until first dataset arrives.
  const dataPending = backendMode === 'checking' || exceptions.length === 0;

  const openExceptions = exceptions.filter((ex) => ex.status !== 'RESOLVED');
  const criticalExceptions = openExceptions.filter((ex) => ex.severity === 'CRITICAL');
  const totalOpenExposure = openExceptions.reduce((sum, ex) => sum + ex.trade.tradeValue, 0);
  const criticalExposure = criticalExceptions.reduce((sum, ex) => sum + ex.trade.tradeValue, 0);
  const avgRiskScore = openExceptions.length > 0
    ? openExceptions.reduce((sum, ex) => sum + ex.riskScore.totalScore, 0) / openExceptions.length
    : 0;
  const criticalRate = openExceptions.length > 0
    ? (criticalExceptions.length / openExceptions.length) * 100
    : 0;
  const topCriticalException = criticalExceptions.sort((a, b) => b.riskScore.totalScore - a.riskScore.totalScore)[0];

  // Counterparty concentration - top counterparty by exposure
  const topCounterpartyByExposure = useMemo(() => {
    if (openExceptions.length === 0) return null;
    const map = new Map<string, { name: string; id: string; exposure: number; priorFailures: number }>();
    for (const ex of openExceptions) {
      const cp = ex.trade.counterparty;
      const key = cp.id;
      const existing = map.get(key);
      if (existing) {
        existing.exposure += ex.trade.tradeValue / 1_000_000;
      } else {
        map.set(key, {
          name: cp.name,
          id: cp.id,
          exposure: ex.trade.tradeValue / 1_000_000,
          priorFailures: cp.priorFailures,
        });
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.exposure - a.exposure);
    return sorted[0] ?? null;
  }, [openExceptions]);

  // Derive counterparty fail concentration from live exceptions data.
  const counterpartyFailDistribution = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, { name: string; cpId: string; fails: number; exposure: number; riskScore: number }>();
    for (const ex of open) {
      const cp = ex.trade.counterparty;
      const shortName = cp.name.split(' ').slice(0, 2).join(' ');
      const key = cp.id;
      const existing = map.get(key);
      if (existing) {
        existing.exposure = Number((existing.exposure + ex.trade.tradeValue / 1_000_000).toFixed(2));
        existing.riskScore = Math.max(existing.riskScore, ex.riskScore.totalScore);
      } else {
        map.set(key, {
          name: `${shortName} (${cp.id})`,
          cpId: cp.id,
          fails: cp.priorFailures,
          exposure: Number((ex.trade.tradeValue / 1_000_000).toFixed(2)),
          riskScore: ex.riskScore.totalScore,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.fails - a.fails)
      .slice(0, 8);
  }, [exceptions]);

  // Exception severity distribution
  const severityDistribution = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const ex of open) {
      counts[ex.severity] = (counts[ex.severity] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] }));
  }, [exceptions]);

  // Exception type distribution
  const exceptionTypeDistribution = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, number>();
    for (const ex of open) {
      const type = ex.exceptionType || 'Unknown';
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [exceptions]);

  // Settlement rail distribution
  const settlementRailDistribution = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, { count: number; exposure: number }>();
    for (const ex of open) {
      const rail = ex.trade.security.depository || 'Unknown';
      const existing = map.get(rail);
      if (existing) {
        existing.count++;
        existing.exposure += ex.trade.tradeValue / 1_000_000;
      } else {
        map.set(rail, { count: 1, exposure: Number((ex.trade.tradeValue / 1_000_000).toFixed(2)) });
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, count: data.count, exposure: data.exposure, color: SETTLEMENT_RAIL_COLORS[name as keyof typeof SETTLEMENT_RAIL_COLORS] || '#64748B' }))
      .sort((a, b) => b.count - a.count);
  }, [exceptions]);

  // Asset class exposure
  const assetClassExposure = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, { count: number; exposure: number; riskScore: number }>();
    for (const ex of open) {
      const assetClass = ex.trade.security.assetClass || 'Unknown';
      const existing = map.get(assetClass);
      if (existing) {
        existing.count++;
        existing.exposure += ex.trade.tradeValue / 1_000_000;
        existing.riskScore = Math.max(existing.riskScore, ex.riskScore.totalScore);
      } else {
        map.set(assetClass, { count: 1, exposure: Number((ex.trade.tradeValue / 1_000_000).toFixed(2)), riskScore: ex.riskScore.totalScore });
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, count: data.count, exposure: data.exposure, riskScore: data.riskScore }))
      .sort((a, b) => b.exposure - a.exposure);
  }, [exceptions]);

  // Counterparty risk table data
  const counterpartyRiskData = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    const map = new Map<string, {
      name: string;
      id: string;
      exposure: number;
      openExceptions: number;
      priorFailures: number;
      failRate: number;
      avgResolution: number;
      riskScore: number;
      creditRating: string;
    }>();
    for (const ex of open) {
      const cp = ex.trade.counterparty;
      const key = cp.id;
      const existing = map.get(key);
      if (existing) {
        existing.exposure += ex.trade.tradeValue / 1_000_000;
        existing.openExceptions++;
        existing.riskScore = Math.max(existing.riskScore, ex.riskScore.totalScore);
      } else {
        map.set(key, {
          name: cp.name,
          id: cp.id,
          exposure: Number((ex.trade.tradeValue / 1_000_000).toFixed(2)),
          openExceptions: 1,
          priorFailures: cp.priorFailures,
          failRate: cp.historicalFailRate,
          avgResolution: cp.avgResolutionTimeHours,
          riskScore: ex.riskScore.totalScore,
          creditRating: cp.creditRating,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);
  }, [exceptions]);

  // Settlement timeline data - based on actual settlement events
  const settlementTimeline = useMemo(() => {
    const open = exceptions.filter((ex) => ex.status !== 'RESOLVED');
    return open.slice(0, 6).map((ex) => {
      const trade = ex.trade;
      const cutoffMins = trade.cutoffMinutesRemaining;
      const isOverdue = cutoffMins <= 0;
      const isCritical = cutoffMins <= 120;
      const isWarning = cutoffMins <= 240;

      let stage: 'trade' | 'affirmation' | 'matching' | 'cutoff' | 'settlement' | 'exception' = 'trade';
      if (isOverdue) stage = 'exception';
      else if (isCritical) stage = 'cutoff';
      else if (isWarning) stage = 'matching';
      else if (trade.instructionStatus === 'PENDING') stage = 'affirmation';
      else if (trade.instructionStatus === 'MISSING' || trade.instructionStatus === 'MISMATCHED') stage = 'exception';
      else stage = 'matching';

      return {
        tradeId: trade.id,
        ticker: trade.security.ticker,
        counterparty: trade.counterparty.name,
        value: trade.tradeValue / 1_000_000,
        stage,
        cutoffDisplay: formatCutoffRemaining(cutoffMins),
        isOverdue,
        isCritical,
        isWarning,
        riskScore: ex.riskScore.totalScore,
        exceptionType: ex.exceptionType,
      };
    });
  }, [exceptions]);

  // Pipeline status derived strictly from live exception workflow states — no fabricated timestamps.
  const pipelineStatus = useMemo(() => {
    const countBy = (status: string) => exceptions.filter((ex) => ex.status === status).length;
    return [
      { stage: 'OPEN — Awaiting Triage', count: countBy('OPEN'), state: 'idle' as const },
      { stage: 'INVESTIGATING — Agent Running', count: countBy('INVESTIGATING'), state: 'running' as const },
      { stage: 'PENDING_APPROVAL — Human Review', count: countBy('PENDING_APPROVAL'), state: 'attention' as const },
      { stage: 'ESCALATED — Ops Lead Engaged', count: countBy('ESCALATED'), state: 'attention' as const },
      { stage: 'RESOLVED — Case Created', count: countBy('RESOLVED'), state: 'done' as const },
    ];
  }, [exceptions]);

  // Cortex Intelligence status
  const cortexStatus = useMemo(() => ({
    analyst: backendMode === 'live',
    search: backendMode === 'live',
    semanticView: backendMode === 'live',
    lastAnalystQuery: backendMode === 'live' ? 'Critical exceptions approaching cutoff' : '—',
    lastSearchResult: backendMode === 'live' ? 'SOP-OPS-032 §3.2 retrieved' : '—',
    provenance: backendMode === 'live' ? 'LIVE SNOWFLAKE' : 'LOCAL FALLBACK',
  }), [backendMode]);

  // Format helper
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number) => value.toLocaleString();

  // Data availability indicators
  const dataProvenance: ProvenanceKey = backendMode === 'live' ? 'live' : 'fallback';

  if (dataPending) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading dashboard from Snowflake">
        <div className="flex items-center justify-between bg-[#0F172A]/60 border border-slate-800 p-5 rounded-2xl">
          <div className="space-y-2">
            <div className="h-5 w-72 rounded bg-slate-800 animate-pulse" />
            <div className="h-3 w-96 rounded bg-slate-800/70 animate-pulse" />
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500">
            <Database className="w-3.5 h-3.5 animate-pulse" />
            QUERYING SNOWFLAKE…
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-[104px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard className="lg:col-span-2 h-80" />
          <SkeletonCard className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#121A2D] via-[#0E1626] to-[#0A101D] border border-slate-700/80 p-4 sm:p-5 rounded-2xl shadow-lg">
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
          {/* Data freshness indicator */}
          <div className="hidden md:flex items-center space-x-2 text-xs font-mono bg-[#0F172A] border border-slate-700 px-3 py-2 rounded-xl">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">
              {lastDataRefreshAt
                ? `REFRESHED ${new Date(lastDataRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'AWAITING FIRST LOAD…'}
            </span>
            <button
              onClick={() => { refreshData(); }}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold"
              title="Re-query Snowflake for fresh exceptions"
            >
              <RefreshCw className="w-3 h-3" />
              <span>SYNC</span>
            </button>
          </div>

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
              : 'bg-[#162032] text-slate-500 cursor-not-allowed'} text-xs font-bold transition-all`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{topCriticalException ? `Investigate ${topCriticalException.tradeId}` : 'No Critical Exceptions'}</span>
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards — Derived from Live Exceptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Trades with Exceptions */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Open Trades with Exceptions</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {formatNumber(openExceptions.length)}
            </span>
            <ProvenanceTag kind={dataProvenance} />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-1">
            <span>Settlement Rate:</span>
            {dashboardMetrics.settlementRatePercent !== null ? (
              <span className="text-emerald-400 font-bold">{dashboardMetrics.settlementRatePercent}%</span>
            ) : (
              <ProvenanceTag kind="unavailable" />
            )}
            <span className="text-slate-500">(COMPUTED)</span>
          </div>
        </div>

        {/* Total Exceptions */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Exception Queue</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
              {openExceptions.length}
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
              {criticalRate.toFixed(1)}% CRITICAL
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Avg Risk Score: <span className="text-slate-200 font-bold">{avgRiskScore.toFixed(1)} / 100</span>
            {' '}<span className="text-slate-500">(COMPUTED)</span>
          </div>
        </div>

        {/* Critical Exceptions */}
        <div className="bg-gradient-to-br from-[#1A101C] to-[#0F172A] border border-rose-500/40 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-rose-300 text-xs font-bold">
            <span>Critical Exceptions (&lt; 2h Cutoff)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {criticalExceptions.length}
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/40 whitespace-nowrap">
              URGENT ACTION
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono truncate">
            Highest Score: <span className="text-rose-300 font-bold">{topCriticalException ? `${topCriticalException.riskScore.totalScore}/100 (${topCriticalException.tradeId})` : '—'}</span>
            {' '}<span className="text-slate-500">(COMPUTED)</span>
          </div>
        </div>

        {/* Critical Gross Exposure */}
        <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Critical Gross Exposure</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {formatCurrency(criticalExposure)}
            </span>
            <ProvenanceTag kind={dataProvenance} />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Total Open Exposure: <span className="text-emerald-400 font-bold">{formatCurrency(totalOpenExposure)}</span>
            {' '}<span className="text-slate-500">(COMPUTED)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Queue & Top-Right Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Critical Exceptions Priority Queue (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-4 shadow-lg">
          <PanelHeader
            title="Critical Priority Queue"
            badge={
              <span className="text-[9px] font-mono bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 font-semibold whitespace-nowrap">
                DETERMINISTIC SCORING
              </span>
            }
            meta={
              <button
                onClick={() => setActiveTab('exceptions')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-0.5 whitespace-nowrap"
              >
                <span>{criticalExceptions.length} CRITICAL / {openExceptions.length} TOTAL</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          <div className="space-y-3">
            {criticalExceptions.slice(0, 4).map((ex) => (
              <div
                key={ex.id}
                onClick={() => selectExceptionForInvestigation(ex.tradeId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') selectExceptionForInvestigation(ex.tradeId); }}
                className={`p-4 rounded-xl border-l-4 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm ${
                  ex === topCriticalException
                    ? 'bg-[#181324] hover:bg-[#201830] border-rose-500/60'
                    : 'bg-[#162032] hover:bg-[#1C2A44] border-rose-500/30'
                }`}
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#0F172A] border border-rose-500/40 shrink-0">
                    <span className="text-base font-bold font-mono text-rose-400 leading-none">
                      {ex.riskScore.totalScore}
                    </span>
                    <span className="text-[8px] font-mono text-slate-400 mt-0.5 font-bold">SCORE</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">{ex.tradeId}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#0F172A] border border-slate-700 text-slate-200">{ex.trade.security.ticker}</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">${(ex.trade.tradeValue / 1000000).toFixed(1)}M</span>
                      {ex === topCriticalException && <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/40">TOP RISK</span>}
                    </div>

                    <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 text-slate-200 truncate"><Building2 className="w-3 h-3 text-slate-400 shrink-0" />{ex.trade.counterparty.name} ({ex.trade.counterparty.id})</span>
                      <span className="text-rose-400 font-semibold font-mono text-[11px]">• {ex.trade.counterparty.priorFailures} prior failures</span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 truncate"><span className="text-amber-400 font-medium truncate">{ex.riskScore.factors[0]?.factor || ex.exceptionType}</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-700/70">
                  <div className={`flex items-center space-x-1.5 text-xs font-mono ${ex.trade.cutoffMinutesRemaining <= 0 ? 'text-rose-400 font-bold' : 'text-amber-300'}`}>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{formatCutoffRemaining(ex.trade.cutoffMinutesRemaining)}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); selectExceptionForInvestigation(ex.tradeId); }} className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-colors"><Sparkles className="w-3.5 h-3.5" /><span>Investigate</span></button>
                </div>
              </div>
            ))}

            {criticalExceptions.length === 0 && (
              <EmptyState message="No CRITICAL severity exceptions are currently open. Monitor HIGH-severity rows in the exception queue." compact />
            )}
          </div>
        </div>

        {/* Right Column: Top Signal Only */}
        <div className="space-y-5">
          <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-3 shadow-lg">
            <PanelHeader
              title="Counterparty Fail Concentration"
              meta={<ProvenanceTag kind={dataProvenance} />}
            />
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={counterpartyFailDistribution} layout="vertical" margin={{ left: 5, right: 34, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={112}
                    tickFormatter={truncateTick}
                    tick={{ ...CHART_TICK_STYLE, fill: '#CBD5E1' }}
                    axisLine={{ stroke: CHART_GRID_STROKE }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(value: any) => [`${value} fails`, 'Prior 30d']} />
                  <Bar dataKey="fails" fill="#FF3B5C" radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList dataKey="fails" position="right" fill="#94A3B8" fontSize={10} fontFamily="monospace" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2"><Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-white">{topCounterpartyByExposure?.name || '—'} ({topCounterpartyByExposure?.id || '—'})</strong> leads by exposure at ${(topCounterpartyByExposure?.exposure ?? 0).toFixed(1)}M with {topCounterpartyByExposure?.priorFailures ?? 0} prior failures.</span></div>
          </div>

          <div className="bg-[#0F172A] border border-slate-700/80 p-5 rounded-2xl space-y-3 shadow-lg">
            <PanelHeader
              title="Institutional Playbooks"
              meta={<span className="text-[9px] font-mono text-cyan-400 font-bold">SNOWFLAKE KB</span>}
            />
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                <div className="flex items-center justify-between gap-2 text-slate-200 font-medium">
                  <span>Expedited SSI Repair SOP §3.2</span>
                  <ProvenanceTag kind="unavailable" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">Historical match rate and resolution improvement metrics require populated HISTORICAL_CASES data. {backendMode === 'live' ? 'LIVE SNOWFLAKE connection active.' : ''}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#162032] border border-slate-700">
                <div className="flex items-center justify-between gap-2 text-slate-200 font-medium">
                  <span>Cash Variance SOP §2.4</span>
                  <ProvenanceTag kind="unavailable" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">Auto-adjustment protocol performance not tracked in current dataset.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Analytics — dense responsive tile grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">Operational Analytics</h2>
          <ProvenanceTag kind={dataProvenance} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Severity Distribution */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Exception Severity" meta={<ProvenanceTag kind="computed" />} />
            <div className="h-44 w-full">
              {severityDistribution.length > 0 ? (
                <div className="relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={severityDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="#070B12"
                      >
                        {severityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: any) => [value.toString(), 'Exceptions']} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                    <span className="text-xl font-bold font-mono text-white leading-none">{openExceptions.length}</span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">OPEN</span>
                  </div>
                </div>
              ) : (
                <EmptyState message="No open exceptions to plot." compact />
              )}
            </div>
          </div>

          {/* Exception Type Distribution */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Exception Types" meta={<ProvenanceTag kind={dataProvenance} />} />
            <div className="h-44 w-full">
              {exceptionTypeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={exceptionTypeDistribution.slice(0, 7)} layout="vertical" margin={{ left: 5, right: 26, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={128}
                      tickFormatter={truncateTick}
                      tick={{ ...CHART_TICK_STYLE, fill: '#CBD5E1' }}
                      axisLine={{ stroke: CHART_GRID_STROKE }}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(value: any) => [value.toString(), 'Exceptions']} />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={12}>
                      <LabelList dataKey="value" position="right" fill="#94A3B8" fontSize={9} fontFamily="monospace" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No open exceptions to classify." compact />
              )}
            </div>
          </div>

          {/* Settlement Rail Distribution */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Settlement Rails" meta={<ProvenanceTag kind={dataProvenance} />} />
            <div className="h-44 w-full">
              {settlementRailDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={settlementRailDistribution} layout="vertical" margin={{ left: 5, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={90}
                      tick={{ ...CHART_TICK_STYLE, fill: '#CBD5E1' }}
                      axisLine={{ stroke: CHART_GRID_STROKE }}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(value: any, name: any) => [value.toString(), name === 'count' ? 'Count' : 'Exposure ($M)']} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <Bar dataKey="count" name="Count" fill="#10B981" radius={[0, 4, 4, 0]} barSize={10}>
                      <LabelList dataKey="count" position="right" fill="#94A3B8" fontSize={9} fontFamily="monospace" />
                    </Bar>
                    <Bar dataKey="exposure" name="Exposure $M" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No open exceptions mapped to rails." compact />
              )}
            </div>
          </div>

          {/* Asset Class Exposure */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Asset Class Exposure" meta={<ProvenanceTag kind={dataProvenance} />} />
            <div className="h-44 w-full">
              {assetClassExposure.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetClassExposure} layout="vertical" margin={{ left: 5, right: 44, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={92}
                      tick={{ ...CHART_TICK_STYLE, fill: '#CBD5E1' }}
                      axisLine={{ stroke: CHART_GRID_STROKE }}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(value: any) => [formatCurrency(value * 1_000_000), 'Exposure']} />
                    <Bar dataKey="exposure" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={14}>
                      <LabelList dataKey="exposure" position="right" formatter={(v: any) => `$${Number(v).toFixed(1)}M`} fill="#94A3B8" fontSize={9} fontFamily="monospace" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No open exception exposure by asset class." compact />
              )}
            </div>
          </div>

          {/* Counterparty Risk Table */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Counterparty Risk" meta={<ProvenanceTag kind={dataProvenance} />} />
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {counterpartyRiskData.length > 0 ? (
                <>
                  <div className="flex text-[9px] font-mono text-slate-500 uppercase tracking-wide border-b border-slate-700 pb-1 sticky top-0 bg-[#0F172A]">
                    <span className="flex-1 min-w-0">Counterparty</span>
                    <span className="w-16 text-right">Exposure</span>
                    <span className="w-10 text-right">Open</span>
                    <span className="w-12 text-right">Risk</span>
                    <span className="w-12 text-right">Rating</span>
                  </div>
                  {counterpartyRiskData.slice(0, 8).map((cp) => (
                    <div key={cp.id} className="flex text-[11px] font-mono text-slate-300 py-1.5 border-b border-slate-800/50 hover:bg-[#162032] rounded px-1 transition-colors">
                      <span className="flex-1 min-w-0 truncate" title={`${cp.name} (${cp.id}) • ${cp.priorFailures} prior fails`}>{cp.name} ({cp.id})</span>
                      <span className="w-16 text-right text-emerald-400">{formatCurrency(cp.exposure * 1_000_000)}</span>
                      <span className="w-10 text-right text-amber-400">{cp.openExceptions}</span>
                      <span className={`w-12 text-right font-bold ${cp.riskScore >= 80 ? 'text-rose-400' : cp.riskScore >= 60 ? 'text-amber-400' : 'text-cyan-400'}`}>{cp.riskScore}</span>
                      <span className="w-12 text-right text-slate-400">{cp.creditRating}</span>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState message="No counterparty risk concentration in open exceptions." compact />
              )}
            </div>
          </div>

          {/* Settlement Timeline */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Settlement Urgency" meta={<ProvenanceTag kind="computed" />} />
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {settlementTimeline.length > 0 ? (
                settlementTimeline.map((item) => (
                  <div key={item.tradeId} className="p-2.5 rounded-lg bg-[#162032] border border-slate-700/80 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-white">{item.tradeId}</span>
                      <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded border ${item.isOverdue ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' : item.isCritical ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : item.isWarning ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                        {item.isOverdue ? 'OVERDUE' : item.isCritical ? 'CRITICAL' : item.isWarning ? 'WARNING' : 'ON TRACK'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400 font-mono">
                      <span>{item.ticker}</span>
                      <span className="text-emerald-400">{formatCurrency(item.value * 1_000_000)}</span>
                      <span className="text-rose-400">RISK {item.riskScore}</span>
                      <span className={item.isOverdue ? 'text-rose-300 font-bold' : 'text-slate-300'}>{item.cutoffDisplay}</span>
                      <span className="text-amber-400/90 truncate">{item.exceptionType}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No urgency signals — every open exception is past its window or resolved." compact />
              )}
            </div>
          </div>

          {/* Cortex Intelligence Status */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader
              title="Cortex Intelligence"
              meta={
                <span className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${cortexStatus.analyst ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {cortexStatus.provenance}
                </span>
              }
            />
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Cortex Analyst', ok: cortexStatus.analyst },
                { label: 'Cortex Search', ok: cortexStatus.search },
                { label: 'Semantic View', ok: cortexStatus.semanticView },
              ].map((svc) => (
                <div key={svc.label} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#162032] border border-slate-700/80">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${svc.ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    {svc.label}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${svc.ok ? 'text-emerald-400' : 'text-slate-500'}`}>{svc.ok ? 'ACTIVE' : 'OFFLINE'}</span>
                </div>
              ))}
              <div className="p-2 rounded-lg bg-[#0B1120] border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">Last Analyst Query</div>
                <div className="text-slate-200 font-mono text-[10px] truncate mt-0.5">{cortexStatus.lastAnalystQuery}</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0B1120] border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">Last Search</div>
                <div className="text-slate-200 font-mono text-[10px] truncate mt-0.5">{cortexStatus.lastSearchResult}</div>
              </div>
            </div>
          </div>

          {/* Investigation Pipeline Status */}
          <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
            <PanelHeader title="Investigation Pipeline" meta={<ProvenanceTag kind="computed" />} />
            <div className="space-y-1.5">
              {pipelineStatus.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#162032] border border-slate-700/80">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    stage.state === 'done'
                      ? 'bg-emerald-400'
                      : stage.state === 'attention'
                      ? 'bg-cyan-400'
                      : stage.state === 'running'
                      ? 'bg-blue-400 animate-pulse'
                      : 'bg-slate-500'
                  }`} />
                  <span className="text-slate-300 flex-1 truncate font-mono">{stage.stage}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    stage.count > 0 ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/60 text-slate-500'
                  }`}>
                    {stage.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
