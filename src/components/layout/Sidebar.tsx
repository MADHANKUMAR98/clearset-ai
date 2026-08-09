import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  AlertOctagon, 
  Sparkles, 
  Bot, 
  FolderArchive, 
  BookOpen, 
  ShieldAlert,
  Cpu
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, dashboardMetrics, cases } = useApp();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'exceptions',
      label: 'Exceptions Queue',
      icon: AlertOctagon,
      badge: dashboardMetrics.totalExceptions.toString(),
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    {
      id: 'investigation',
      label: 'Investigation Workspace',
      icon: Sparkles,
      badge: 'TRD-92831',
      badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold',
    },
    {
      id: 'copilot',
      label: 'AI Copilot',
      icon: Bot,
      badge: 'CORTEX',
      badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'cases',
      label: 'Cases Ledger',
      icon: FolderArchive,
      badge: cases.length.toString(),
      badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 'policies',
      label: 'Policies & SOPs',
      icon: BookOpen,
      badge: '4 SOPs',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
  ];

  return (
    <aside className="w-64 border-r border-[#1E293B] bg-[#0A0F1D]/70 backdrop-blur-md flex flex-col justify-between p-4 shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        {/* Ops Section Title */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 font-mono">
            Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/25 to-cyan-500/10 text-white border border-cyan-500/40 shadow-sm shadow-cyan-500/10 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#111827] border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Triage Priority Box */}
        <div className="bg-[#0F172A] border border-slate-700/80 rounded-xl p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Priority Risk
            </span>
            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30 font-mono">
              {dashboardMetrics.criticalExceptions} Critical
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <button
              onClick={() => {
                setActiveTab('investigation');
              }}
              className="w-full p-2 rounded-lg bg-[#162032] hover:bg-[#1B273F] border border-rose-500/40 flex items-center justify-between text-left transition-colors"
            >
              <div>
                <div className="font-mono text-white font-bold text-xs flex items-center gap-1">
                  <span>TRD-92831</span>
                  <span className="text-[9px] font-normal text-rose-400 bg-rose-500/10 px-1 rounded">DVP</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">$2.4M • CP-192 (Apex)</div>
              </div>
              <div className="text-right">
                <span className="text-rose-400 font-bold font-mono text-xs">91</span>
                <div className="text-[9px] text-amber-400 font-mono">1h 42m</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Telemetry */}
      <div className="pt-4 border-t border-slate-800">
        <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              ClearSet Engine
            </span>
            <span className="text-cyan-400 font-mono text-[10px] font-semibold">PHASE 1</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono leading-tight">
            Cortex Analyst & Search Architecture
            <br />
            10-Step Procedural Memory
          </div>
        </div>
      </div>
    </aside>
  );
};
