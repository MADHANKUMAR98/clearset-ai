import React, { useEffect, useMemo, useState } from 'react';
import { Link2, AlertTriangle, CheckCircle2, Radio, Clock } from 'lucide-react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { fetchExceptionsFromApi, fetchSettlementEventsFromApi } from '../services/apiClient';
import { PanelHeader, ProvenanceTag, SkeletonCard, EmptyState } from './ui/primitives';

interface ChainHop {
  id: string;
  timestamp: string;
  messageType: string;
  status: string;
  description: string;
  source: string;
}

interface TradeOption {
  tradeId: string;
  severity: string;
  riskScore: number;
}

const SOURCE_COLORS: Record<string, string> = {
  MATCHING_ENGINE: '#3B82F6',
  CUSTODIAN: '#F59E0B',
  DEPOSITORY: '#22D3EE',
  SWIFT_GATEWAY: '#A78BFA',
  CLEARSET_AGENT: '#10B981',
};

const outcomeOf = (status: string): 'bad' | 'warn' | 'good' | 'neutral' => {
  const s = (status || '').toUpperCase();
  if (/(NOT_FOUND|FAILED|REJECTED|BROKEN|ESCALATION)/.test(s)) return 'bad';
  if (/(WARNING|MISMATCH|DUPLICATE|BREAK|PENDING)/.test(s)) return 'warn';
  if (/(SETTLED|MATCHED|AFFIRMED|INSTRUCTED)/.test(s)) return 'good';
  return 'neutral';
};

const OUTCOME_COLORS = {
  bad: '#FF3B5C',
  warn: '#F59E0B',
  good: '#10B981',
  neutral: '#64748B',
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const minutesBetween = (a: string, b: string): string => {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return '';
  const secs = Math.round((db - da) / 1000);
  if (Math.abs(secs) < 90) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (Math.abs(mins) < 90) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
};

/**
 * Settlement Chain Visualisation (feature-flagged: VITE_SETTLEMENT_CHAIN_VIZ).
 * Renders nothing unless the flag is on. Self-fetches the exceptions list and
 * the SWIFT/depository event trail for the selected trade — no data-flow changes.
 */
export const SettlementChainViz: React.FC = () => {
  const enabled = useFeatureFlag('SETTLEMENT_CHAIN_VIZ');
  const [options, setOptions] = useState<TradeOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hops, setHops] = useState<ChainHop[]>([]);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [hopsState, setHopsState] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchExceptionsFromApi()
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data ?? []) as Array<Record<string, unknown>>;
        const opts: TradeOption[] = rows
          .map((row) => ({
            tradeId: String(row.TRADE_ID ?? ''),
            severity: String(row.SEVERITY ?? ''),
            riskScore: Number(row.RISK_SCORE ?? 0),
          }))
          .filter((o) => o.tradeId)
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, 10);
        setOptions(opts);
        setSelected((prev) => prev ?? opts[0]?.tradeId ?? null);
        setState(opts.length > 0 ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !selected) return undefined;
    let cancelled = false;
    setHopsState('loading');
    fetchSettlementEventsFromApi(selected)
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data ?? []) as Array<Record<string, unknown>>;
        if (rows.length === 0) {
          setHops([]);
          setHopsState('empty');
          return;
        }
        const parsed: ChainHop[] = rows
          .map((row) => ({
            id: String(row.EVENT_ID ?? Math.random()),
            timestamp: String(row.EVENT_TIMESTAMP ?? ''),
            messageType: String(row.MESSAGE_TYPE ?? ''),
            status: String(row.EVENT_STATUS ?? row.STATUS ?? ''),
            description: String(row.DESCRIPTION ?? ''),
            source: String(row.SOURCE ?? ''),
          }))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setHops(parsed);
        setCutoff(String(rows[0].CUTOFF_TIME ?? ''));
        setCounterparty(String(rows[0].COUNTERPARTY_NAME ?? ''));
        setHopsState('ready');
      })
      .catch(() => {
        if (!cancelled) setHopsState('empty');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, selected]);

  const cutoffMinutes = useMemo(() => {
    if (!cutoff) return null;
    const diff = new Date(cutoff).getTime() - Date.now();
    if (Number.isNaN(diff)) return null;
    return Math.round(diff / 60000);
  }, [cutoff]);

  if (!enabled) return null;

  if (state === 'loading') {
    return (
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <PanelHeader title="Settlement Chain Trace" meta={<ProvenanceTag kind="computed" />} />
        <SkeletonCard className="h-[220px]" />
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <PanelHeader title="Settlement Chain Trace" meta={<ProvenanceTag kind="unavailable" />} />
        <EmptyState message="Chain trace requires a live Snowflake connection." compact />
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
      <PanelHeader
        title="Settlement Chain Trace"
        badge={
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <Link2 className="w-3 h-3 inline-block mr-1" />
            HOP-BY-HOP
          </span>
        }
        meta={<ProvenanceTag kind="live" />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-mono text-slate-400" htmlFor="chain-trade-select">
          TRADE
        </label>
        <select
          id="chain-trade-select"
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-[#162032] border border-slate-700 text-white text-xs font-mono rounded-lg px-2 py-1.5 outline-none focus:border-cyan-500/60"
        >
          {options.map((o) => (
            <option key={o.tradeId} value={o.tradeId}>
              {o.tradeId} · {o.severity} · {o.riskScore}
            </option>
          ))}
        </select>
        {counterparty && (
          <span className="text-[10px] font-mono text-slate-400">vs {counterparty}</span>
        )}
        {cutoffMinutes !== null && (
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              cutoffMinutes < 0
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                : cutoffMinutes < 120
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            }`}
          >
            <Clock className="w-3 h-3 inline-block mr-1" />
            {cutoffMinutes < 0
              ? `${Math.abs(cutoffMinutes)}m PAST CUTOFF`
              : `${cutoffMinutes}m TO CUTOFF`}
          </span>
        )}
      </div>

      {hopsState === 'loading' && <SkeletonCard className="h-[200px]" />}

      {hopsState === 'empty' && (
        <EmptyState message="No settlement events recorded for this trade." compact />
      )}

      {hopsState === 'ready' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-0 min-w-max">
            {hops.map((hop, idx) => {
              const outcome = outcomeOf(hop.status);
              const color = OUTCOME_COLORS[outcome];
              const gap =
                idx > 0 ? minutesBetween(hops[idx - 1].timestamp, hop.timestamp) : null;
              const sourceColor = SOURCE_COLORS[hop.source] ?? '#64748B';

              return (
                <React.Fragment key={hop.id}>
                  {idx > 0 && (
                    <div className="flex flex-col items-center justify-center px-1 min-w-[54px]">
                      <div
                        className="h-[2px] w-full rounded"
                        style={{ backgroundColor: color, opacity: 0.7 }}
                      />
                      <span className="text-[9px] font-mono text-slate-500 mt-1 whitespace-nowrap">
                        +{gap ?? '—'}
                      </span>
                    </div>
                  )}
                  <div
                    className="w-[186px] shrink-0 rounded-xl border p-2.5 bg-[#162032]"
                    style={{ borderColor: `${color}55` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border truncate"
                        style={{
                          color: sourceColor,
                          backgroundColor: `${sourceColor}1A`,
                          borderColor: `${sourceColor}44`,
                        }}
                      >
                        {hop.source}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        {formatTime(hop.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      {outcome === 'bad' ? (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      ) : outcome === 'good' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      ) : (
                        <Radio className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      )}
                      <span
                        className="text-[10px] font-mono font-bold truncate"
                        style={{ color }}
                        title={hop.status}
                      >
                        {hop.status || '—'}
                      </span>
                    </div>

                    <div className="text-[9px] font-mono text-cyan-300/80 mt-1">
                      {hop.messageType}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug mt-1.5">
                      {hop.description}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-[9px] font-mono text-slate-500 leading-relaxed border-t border-slate-700/50 pt-2">
        HOPS SOURCE: LIVE <span className="text-slate-400">SETTLEMENT_EVENTS</span> (SWIFT +
        DEPOSITORY AUDIT TRAIL). ELAPSED TIME SHOWN BETWEEN HOPS. BREAK POINTS MARKED IN RED.
      </div>
    </div>
  );
};

export default SettlementChainViz;
