import React, { useEffect, useState } from 'react';
import { Clock, DollarSign, TrendingUp } from 'lucide-react';
import { fetchImpactMetrics } from '../services/apiClient';
import type { ImpactMetrics } from '../services/types';
import { PanelHeader, ProvenanceTag, SkeletonCard, EmptyState } from './ui/primitives';

const formatUsd = (value: number): string => {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

/**
 * Operational Impact tile — additive DashboardView panel.
 * Self-fetches GET /api/metrics so the main context/data flow is untouched.
 * Renders DATA NOT AVAILABLE honestly when Snowflake is unreachable.
 */
export const ImpactMetricsTile: React.FC = () => {
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchImpactMetrics()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setMetrics(res.data);
          setState('ready');
        } else {
          setState('unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return <SkeletonCard className="h-[196px]" />;
  }

  if (state === 'unavailable' || !metrics) {
    return (
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <PanelHeader title="Operational Impact" meta={<ProvenanceTag kind="unavailable" />} />
        <div className="h-24">
          <EmptyState message="Impact metrics require a live Snowflake connection." compact />
        </div>
      </div>
    );
  }

  const provenance = metrics.source === 'snowflake' ? 'live' : 'unavailable';

  return (
    <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
      <PanelHeader
        title="Operational Impact"
        meta={<ProvenanceTag kind={provenance} />}
      />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#162032] border border-slate-700/80">
          <span className="flex items-center gap-2 text-slate-300 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            Open Fail Exposure
            <span className="text-slate-500 font-mono text-[10px]">({metrics.openExceptionCount})</span>
          </span>
          <span className="text-xs font-mono font-bold text-white">{formatUsd(metrics.openExceptionValueUSD)}</span>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#162032] border border-slate-700/80">
          <span className="text-slate-300 text-xs">Cases Human-Approved</span>
          <span className="text-xs font-mono font-bold text-emerald-400">{metrics.casesApproved}</span>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#162032] border border-slate-700/80">
          <span className="flex items-center gap-2 text-slate-300 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            Avg Approval Turnaround
          </span>
          {metrics.avgApprovalTurnaroundMinutes !== null ? (
            <span className="text-xs font-mono font-bold text-white">
              {metrics.avgApprovalTurnaroundMinutes}m
            </span>
          ) : (
            <ProvenanceTag kind="unavailable" />
          )}
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#162032] to-[#101B30] border border-emerald-500/25">
          <span className="flex items-center gap-2 text-slate-200 text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Est. Penalty Accrual / Day
            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              ESTIMATE
            </span>
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {formatUsd(metrics.csdrExposurePerDayUSD)}
          </span>
        </div>

        <div className="text-[9px] font-mono text-slate-500 leading-relaxed px-1 pt-0.5">
          ACCRUAL ASSUMES 0.025% OF NOTIONAL PER FAIL-DAY (MODELING ASSUMPTION).
          TURNAROUND MEASURED CREATED_AT &rarr; APPROVED_AT ON APPROVED CASES ONLY.
        </div>
      </div>
    </div>
  );
};
