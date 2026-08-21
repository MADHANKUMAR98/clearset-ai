import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Activity, Cpu, Cloud, Database } from 'lucide-react';
import { fetchHealth } from '../../services/apiClient';

type SnowflakeStatus = 'checking' | 'live' | 'local';

export const Navbar: React.FC = () => {
  const { searchQuery, setSearchQuery, dashboardMetrics } = useApp();
  const [snowflakeStatus, setSnowflakeStatus] = useState<SnowflakeStatus>('checking');

  // On mount, check health endpoint. Only claim LIVE SNOWFLAKE if snowflake: true.
  useEffect(() => {
    let cancelled = false;
    fetchHealth(6000).then((health) => {
      if (!cancelled) {
        setSnowflakeStatus(health.snowflake === true ? 'live' : 'local');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    snowflakeStatus === 'checking'
      ? 'CHECKING CONNECTION...'
      : snowflakeStatus === 'live'
        ? 'LIVE SNOWFLAKE'
        : 'LOCAL SIMULATION';

  const statusDotClass =
    snowflakeStatus === 'checking'
      ? 'bg-yellow-400 animate-pulse'
      : snowflakeStatus === 'live'
        ? 'bg-emerald-400'
        : 'bg-cyan-400 animate-pulse';

  const StatusIcon = snowflakeStatus === 'live' ? Cloud : snowflakeStatus === 'checking' ? Database : Cpu;

  return (
    <header className="h-16 border-b border-[#1E293B] bg-[#0A0F1D]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
      {/* Brand & System Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-bold text-white text-base">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white font-sans">CLEARSET</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                AI
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Post-Trade Settlement Copilot</span>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-slate-800 hidden md:block" />

        {/* Snowflake / Backend Status Indicator — driven by GET /api/health */}
        <div className="hidden md:flex items-center space-x-2">
          <div
            className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-medium border bg-slate-900/80 border-slate-700/80 text-slate-300"
            title={
              snowflakeStatus === 'live'
                ? 'Connected to live Snowflake data warehouse (GET /api/health → snowflake: true)'
                : snowflakeStatus === 'checking'
                  ? 'Checking Snowflake connection status…'
                  : 'Running in local simulation mode (Snowflake unavailable or backend stopped)'
            }
          >
            <StatusIcon className={`w-3.5 h-3.5 ${snowflakeStatus === 'live' ? 'text-emerald-400' : snowflakeStatus === 'checking' ? 'text-yellow-400' : 'text-cyan-400'}`} />
            <span className="text-[11px]">{statusLabel}</span>
            <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
          </div>
        </div>
      </div>

      {/* Global Search & Telemetry */}
      <div className="flex items-center space-x-4">
        <div className="relative hidden lg:block w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search ISIN, Trade ID, Counterparty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
          />
        </div>

        {/* Live Exposure Counter */}
        <div className="hidden sm:flex items-center space-x-3 px-3.5 py-1.5 rounded-lg bg-[#111827] border border-slate-700/80 text-xs shadow-inner">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 font-sans">Active Critical Exposure:</span>
          <span className="font-mono font-bold text-amber-400">
            ${(dashboardMetrics.totalExposureDollars / 1000000).toFixed(1)}M
          </span>
        </div>

        {/* User / Analyst Profile */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-xs font-semibold text-white shadow-sm">
            AM
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-medium text-slate-200">Alex Mercer</div>
            <div className="text-[10px] text-slate-400 font-mono">Operations Analyst</div>
          </div>
        </div>
      </div>
    </header>
  );
};
