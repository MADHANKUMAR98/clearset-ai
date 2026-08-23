// ============================================================================
// Shared design tokens & formatting helpers — presentation only.
// Kept separate from components so fast-refresh boundaries stay clean.
// ============================================================================

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#FF3B5C',
  HIGH: '#F59E0B',
  MEDIUM: '#3B82F6',
  LOW: '#10B981',
};

type ProvenanceMeta = { label: string; className: string };

export const PROVENANCE_META = {
  live: {
    label: 'LIVE SNOWFLAKE',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  computed: {
    label: 'COMPUTED',
    className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  fallback: {
    label: 'LOCAL FALLBACK',
    className: 'bg-slate-800/80 text-cyan-300 border-slate-600',
  },
  unavailable: {
    label: 'DATA NOT AVAILABLE',
    className: 'bg-slate-800/80 text-slate-400 border-slate-600',
  },
  knowledge: {
    label: 'LOCAL KNOWLEDGE BASE',
    className: 'bg-slate-800/80 text-slate-300 border-slate-600',
  },
} as const satisfies Record<string, ProvenanceMeta>;

export type ProvenanceKey = keyof typeof PROVENANCE_META;

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0B1120',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 11,
  fontFamily: 'monospace',
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  padding: '6px 10px',
};

export const CHART_GRID_STROKE = '#1E293B';
export const CHART_TICK_STYLE = { fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' };

/** Honest cutoff countdown: negative minutes are past-due, never rendered as bogus "-283h -46m". */
export const formatCutoffRemaining = (mins: number): string => {
  if (!Number.isFinite(mins)) return '—';
  if (mins <= 0) return 'PAST CUTOFF';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};
