import React, { useEffect, useState } from 'react';
import { Terminal, Play, Copy, Check, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { PanelHeader, ProvenanceTag, SkeletonCard, EmptyState } from './ui/primitives';

export interface ReplayEvidence {
  label: string;
  text: string;
}

export interface ReplayStep {
  n: number;
  title: string;
  evidence: ReplayEvidence[];
}

export interface ReplayArtifact {
  skill: string;
  tradeId: string;
  invocation: string;
  status: string;
  startedAt: string;
  durationMs: number;
  steps: ReplayStep[];
  highlight: {
    riskScore?: number;
    rootCause?: string;
    recommendation?: string;
    awaiting?: string;
  };
  transcript: string[];
}

const LABEL_STYLES: Record<string, string> = {
  'LIVE SNOWFLAKE': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  'CORTEX ANALYST': 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  'CORTEX SEARCH': 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30',
  COMPUTED: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  'LOCAL FALLBACK': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
};

const labelStyle = (label: string): string =>
  LABEL_STYLES[label] ?? 'text-slate-300 bg-slate-500/10 border-slate-500/30';

/**
 * CoCo CLI Investigation Replay (feature-flagged: VITE_COCO_CLI_REPLAY).
 * Replays a recorded `cortex exec` run of the investigate-settlement-exception
 * skill from public/coco-replay.json. Rendered only when the flag is on.
 */
export const CocoReplayPanel: React.FC = () => {
  const enabled = useFeatureFlag('COCO_CLI_REPLAY');
  const [artifact, setArtifact] = useState<ReplayArtifact | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetch('/coco-replay.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json && Array.isArray(json.steps) && json.steps.length > 0) {
          setArtifact(json as ReplayArtifact);
          setState('ready');
        } else {
          setState('missing');
        }
      })
      .catch(() => {
        if (!cancelled) setState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;

  if (state === 'loading') {
    return (
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <PanelHeader title="CoCo CLI Investigation Replay" meta={<ProvenanceTag kind="computed" />} />
        <SkeletonCard className="h-[200px]" />
      </div>
    );
  }

  if (state === 'missing' || !artifact) {
    return (
      <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
        <PanelHeader
          title="CoCo CLI Investigation Replay"
          badge={
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border border-slate-600 text-slate-400">
              <Terminal className="w-3 h-3 inline-block mr-1" />
              COCO CLI
            </span>
          }
          meta={<ProvenanceTag kind="unavailable" />}
        />
        <EmptyState
          message="No recorded investigation yet. Run:  npm run coco:investigate -- TRD-92831"
          compact
        />
      </div>
    );
  }

  const copyCommand = () => {
    navigator.clipboard?.writeText(artifact.invocation).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  };

  const mins = Math.round(artifact.durationMs / 6000) / 10;

  return (
    <div className="bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
      <PanelHeader
        title="CoCo CLI Investigation Replay"
        badge={
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Terminal className="w-3 h-3 inline-block mr-1" />
            {artifact.skill}
          </span>
        }
        meta={<ProvenanceTag kind="live" />}
      />

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
        <span className="px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-bold">
          {artifact.tradeId}
        </span>
        <span className={artifact.status === 'complete' ? 'text-emerald-400' : 'text-amber-400'}>
          {artifact.status.toUpperCase()}
        </span>
        <span className="text-slate-500">
          {artifact.steps.length} steps · {mins}s · {artifact.startedAt.slice(0, 19).replace('T', ' ')}
        </span>
        <button
          type="button"
          onClick={copyCommand}
          className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 text-[10px] font-mono transition-colors"
          title="Copy the exact command"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'copied' : 're-run it yourself'}
        </button>
      </div>

      <div className="rounded-lg border border-slate-700/70 bg-black/40 px-3 py-2 font-mono text-[11px] text-slate-300 overflow-x-auto">
        <span className="text-emerald-400 select-none">$ </span>
        {artifact.invocation}
      </div>

      <div className="space-y-2">
        {artifact.steps.map((step) => (
          <div
            key={step.n}
            className="rounded-lg border border-slate-700/60 bg-[#162032] p-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[9px] font-mono font-bold flex items-center justify-center">
                {step.n}
              </span>
              <span className="text-[11px] font-bold text-slate-200">{step.title}</span>
            </div>
            <div className="mt-1.5 space-y-1 ml-7">
              {step.evidence.slice(0, 4).map((ev, i) => (
                <div key={`${step.n}-${i}`} className="flex items-start gap-1.5">
                  <span
                    className={`shrink-0 text-[8px] font-mono font-bold px-1 py-[1px] rounded border ${labelStyle(
                      ev.label,
                    )}`}
                  >
                    {ev.label}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-snug">{ev.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(artifact.highlight.rootCause || artifact.highlight.recommendation) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
          {artifact.highlight.riskScore !== undefined && (
            <div className="text-[11px] font-mono">
              <span className="text-slate-400">DETERMINISTIC RISK: </span>
              <span className="text-rose-400 font-bold">{artifact.highlight.riskScore}/100</span>
            </div>
          )}
          {artifact.highlight.rootCause && (
            <div className="text-[11px] text-slate-300 leading-snug">
              <span className="text-slate-400 font-mono text-[10px]">ROOT CAUSE: </span>
              {artifact.highlight.rootCause}
            </div>
          )}
          {artifact.highlight.recommendation && (
            <div className="text-[11px] text-slate-300 leading-snug">
              <span className="text-slate-400 font-mono text-[10px]">RECOMMENDATION: </span>
              {artifact.highlight.recommendation}
            </div>
          )}
          <div className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1.5 pt-1 border-t border-amber-500/20">
            <ShieldCheck className="w-3 h-3" />
            {artifact.highlight.awaiting ?? 'AWAITING ANALYST AUTHORISATION'}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTranscript((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
      >
        {showTranscript ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        RAW CLI TRANSCRIPT ({artifact.transcript.length} lines)
        <Play className="w-3 h-3" />
      </button>

      {showTranscript && (
        <pre className="max-h-64 overflow-y-auto rounded-lg bg-black/50 border border-slate-700/60 p-3 text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
          {artifact.transcript.join('\n')}
        </pre>
      )}

      <div className="text-[9px] font-mono text-slate-500 leading-relaxed border-t border-slate-700/50 pt-2">
        RECORDED FROM A REAL <span className="text-slate-400">cortex exec</span> RUN OF THE
        REGISTERED SKILL. READ-ONLY: NO CASE CREATED, NO MESSAGE DISPATCHED — FINAL DECISION
        ALWAYS WITH THE ANALYST.
      </div>
    </div>
  );
};

export default CocoReplayPanel;
