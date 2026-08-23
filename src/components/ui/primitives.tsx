import React from 'react';
import { PROVENANCE_META, type ProvenanceKey } from './tokens';

// ============================================================================
// Shared UI primitives — institutional operations console styling.
// Presentation only: no data, no metrics, no business logic.
// ============================================================================

export const ProvenanceTag: React.FC<{ kind: ProvenanceKey; className?: string }> = ({
  kind,
  className = '',
}) => (
  <span
    className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap tracking-wide ${PROVENANCE_META[kind].className} ${className}`}
  >
    {PROVENANCE_META[kind].label}
  </span>
);

export const PanelHeader: React.FC<{
  title: string;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
}> = ({ title, badge, meta }) => (
  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
    <div className="flex items-center gap-2 min-w-0">
      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider font-mono truncate">
        {title}
      </h3>
      {badge}
    </div>
    {meta && <div className="flex items-center gap-1.5 shrink-0">{meta}</div>}
  </div>
);

export const EmptyState: React.FC<{ message: string; compact?: boolean }> = ({
  message,
  compact = false,
}) => (
  <div
    className={`rounded-lg border border-dashed border-slate-700/70 bg-[#0B1120]/60 px-4 ${
      compact ? 'py-4' : 'py-8'
    } text-center`}
  >
    <p className="text-[11px] font-mono text-slate-500 leading-relaxed max-w-xs mx-auto">
      {message}
    </p>
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-xl bg-[#0F172A] border border-slate-800 ${className}`}
    aria-hidden="true"
  />
);
