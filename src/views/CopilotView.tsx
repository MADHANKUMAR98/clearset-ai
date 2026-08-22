import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ChevronRight, 
  Cpu, 
  ArrowRight
} from 'lucide-react';

export const CopilotView: React.FC = () => {
  const { 
    copilotMessages, 
    sendCopilotMessage, 
    selectExceptionForInvestigation, 
    setActiveTab,
    backendMode,
  } = useApp();

  const [inputPrompt, setInputPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [copilotMessages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim()) return;
    sendCopilotMessage(inputPrompt.trim());
    setInputPrompt('');
  };

  const samplePrompts = [
    'Show me critical settlement exceptions approaching cutoff.',
    'Investigate TRD-92831.',
    'Why is TRD-92831 critical?',
    'What should I do according to our SOP?',
    'Have we seen this counterparty fail before?',
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-5rem)] flex flex-col space-y-4">
      {/* Copilot Header */}
      <div className="bg-[#0F172A] p-4 rounded-2xl border border-slate-700/80 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-tight font-sans">ClearSet AI Copilot</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                POST-TRADE AGENT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Grounded in structured settlement telemetry, historical cases & operational SOPs
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-300 bg-[#162032] px-3 py-1.5 rounded-lg border border-slate-700">
          <span className={`w-2 h-2 rounded-full ${
            backendMode === 'live' ? 'bg-emerald-400' : backendMode === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-cyan-400 animate-pulse'
          }`} />
          <span>
            {backendMode === 'live'
              ? 'Live Snowflake · Cortex Analyst Active'
              : backendMode === 'checking'
              ? 'Checking Connection...'
              : 'Local Simulation · Cortex-Ready'}
          </span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        <span className="text-[11px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Demo Prompts:
        </span>
        {samplePrompts.map((prompt, pIdx) => (
          <button
            key={pIdx}
            onClick={() => sendCopilotMessage(prompt)}
            className="px-3 py-1 rounded-full text-xs font-medium bg-[#162032] hover:bg-blue-600 hover:text-white border border-slate-700 text-slate-200 shrink-0 transition-all shadow-sm"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 bg-[#0F172A] border border-slate-700/80 p-5 overflow-y-auto space-y-4 rounded-2xl shadow-inner">
        {copilotMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs space-y-3 ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                    : 'bg-[#162032] text-slate-200 border border-slate-700/90 rounded-tl-none shadow-sm'
                }`}
              >
                {/* Main Text */}
                <div className="leading-relaxed whitespace-pre-line text-xs font-sans">
                  {msg.text}
                </div>

                {/* Structured Rich Widgets */}
                {msg.structuredData && (
                  <div className="pt-2 border-t border-slate-700 space-y-3">
                    {/* Trade Card Widget */}
                    {msg.structuredData.type === 'trade_card' && msg.structuredData.tradeSummary && (
                      <div className="p-3.5 rounded-xl bg-[#0F172A] border border-rose-500/40 space-y-2 font-mono text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-400 text-sm">
                            {msg.structuredData.tradeSummary.id}
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {msg.structuredData.tradeSummary.value}
                          </span>
                        </div>
                        <div className="text-slate-200 text-[11px] font-sans">
                          {msg.structuredData.tradeSummary.cp}
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          Asset: {msg.structuredData.tradeSummary.isin}
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 text-amber-300">
                          <span>{msg.structuredData.tradeSummary.cutoff}</span>
                          <button
                            onClick={() => selectExceptionForInvestigation(msg.structuredData?.tradeSummary?.id || 'TRD-92831')}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1 text-[10px]"
                          >
                            <span>Open Workspace</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Risk Breakdown Widget */}
                    {msg.structuredData.type === 'risk_breakdown' && msg.structuredData.pointsBreakdown && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-100">
                          <span>Explainable Risk Allocation</span>
                          <span className="text-rose-400">{msg.structuredData.riskScore}/100 (CRITICAL)</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.structuredData.pointsBreakdown.map((pt: any, i: number) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-[#0F172A] border border-slate-700 flex items-center justify-between text-[11px]"
                            >
                              <div>
                                <span className="font-semibold text-slate-100 font-sans">{pt.label}</span>
                                <div className="text-[10px] text-slate-400 font-mono">{pt.note}</div>
                              </div>
                              <span className="font-mono font-bold text-rose-400 shrink-0 ml-2 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                                +{pt.points} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SOP Citation Widget */}
                    {msg.structuredData.type === 'sop_citation' && msg.structuredData.policyCitation && (
                      <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-cyan-300 font-bold">
                          <span>{msg.structuredData.policyCitation.doc}</span>
                          <span>{msg.structuredData.policyCitation.section}</span>
                        </div>
                        <p className="text-[11px] text-slate-200 leading-relaxed font-sans">
                          {msg.structuredData.policyCitation.text}
                        </p>
                        <div className="pt-2 flex items-center justify-between text-xs">
                          <button
                            onClick={() => setActiveTab('policies')}
                            className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1"
                          >
                            <span>Read Full SOP Document</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => {
                              selectExceptionForInvestigation('TRD-92831');
                            }}
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] flex items-center gap-1"
                          >
                            <span>Open Investigation</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Counterparty Intelligence Widget */}
                    {msg.structuredData.type === 'counterparty_intelligence' && msg.structuredData.counterparty && (
                      <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white font-sans">{msg.structuredData.counterparty.name}</span>
                            <div className="text-[10px] font-mono text-slate-400">BIC: {msg.structuredData.counterparty.bic}</div>
                          </div>
                          <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                            {msg.structuredData.counterparty.failures} Recent Fails ({msg.structuredData.counterparty.failRate})
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-[#162032] border border-slate-800 text-[11px] flex items-center justify-between font-mono">
                          <span className="text-slate-300">Desk Lead: {msg.structuredData.counterparty.contact}</span>
                          <span className="text-cyan-400">{msg.structuredData.counterparty.desk}</span>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-emerald-400 font-mono font-bold">
                            18 Similar Historical Cases (88.9% Success)
                            {backendMode === 'live' && (
                              <span className="ml-1 text-[10px] text-slate-500 font-normal font-mono">(illustrative)</span>
                            )}
                          </span>
                          <button
                            onClick={() => selectExceptionForInvestigation('TRD-92831', 'counterparty')}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] flex items-center gap-1"
                          >
                            <span>Inspect Counterparty</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Historical Cases Widget */}
                    {msg.structuredData.type === 'historical_cases' && msg.structuredData.similarCases && (
                      <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-700 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between text-slate-200 font-bold">
                          <span>Institutional Resolution Precedents</span>
                          <span className="text-emerald-400">
                            88.9% Success Playbook
                            {backendMode === 'live' && (
                              <span className="ml-1 text-[10px] text-slate-500 font-normal font-mono">(illustrative)</span>
                            )}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                          <div className="p-2 rounded bg-[#162032] border border-slate-800">
                            <span className="text-slate-400 block">Corrected SSI</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {msg.structuredData.similarCases.corrected} (67%)
                            </span>
                          </div>
                          <div className="p-2 rounded bg-[#162032] border border-slate-800">
                            <span className="text-slate-400 block">Escalated</span>
                            <span className="text-sm font-bold text-amber-400">
                              {msg.structuredData.similarCases.escalated} (22%)
                            </span>
                          </div>
                          <div className="p-2 rounded bg-[#162032] border border-slate-800">
                            <span className="text-slate-400 block">Failed</span>
                            <span className="text-sm font-bold text-rose-400">
                              {msg.structuredData.similarCases.failed} (11%)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Suggested follow-up prompt chips */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                    {msg.suggestedFollowUps.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => sendCopilotMessage(chip)}
                        className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#0F172A] hover:bg-blue-600 hover:text-white text-slate-300 border border-slate-700 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="bg-[#0F172A] p-2 rounded-2xl border border-slate-700/80 flex items-center space-x-2 shrink-0 shadow-lg">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask ClearSet AI about settlement exceptions, risk scoring, SOP guidance, or counterparty history..."
          className="flex-1 bg-transparent px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-blue-600/20"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
