import React, { useState } from 'react';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';
import { 
  BookOpen, 
  Search, 
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PoliciesView: React.FC = () => {
  const { sendCopilotMessage, setActiveTab } = useApp();
  const [selectedDoc, setSelectedDoc] = useState(POLICY_DOCUMENTS[0]);
  const [selectedSection, setSelectedSection] = useState(POLICY_DOCUMENTS[0].sections[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = POLICY_DOCUMENTS.filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.code.toLowerCase().includes(q) ||
      doc.sections.some((s) => s.sectionTitle.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Operational SOP & Policy Knowledge Base
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Grounding repository for autonomous investigation, citation verification, and regulatory compliance
          </p>
        </div>

        <button
          onClick={() => {
            setActiveTab('copilot');
            sendCopilotMessage('What should I do according to our SOP?');
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#162032] hover:bg-[#1E2C48] text-cyan-300 border border-cyan-500/30 text-xs font-semibold shadow-sm transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ask Copilot to Retrieve SOP</span>
        </button>
      </div>

      {/* Main Grid: Policy Browser & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Documents Directory (4 Cols) */}
        <div className="lg:col-span-4 bg-[#0F172A] border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-lg">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SOPs, sections, rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-2">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setSelectedSection(doc.sections[0]);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                    isSelected
                      ? 'bg-[#16293D] border-cyan-500/50 shadow-md'
                      : 'bg-[#162032] border-slate-700 hover:bg-[#1B273F]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-cyan-400">
                      {doc.code}
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#0F172A] text-slate-300 border border-slate-700">
                      {doc.category}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white mt-1 font-sans">
                    {doc.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 flex items-center justify-between">
                    <span>{doc.sections.length} Sections</span>
                    <span>v{doc.version}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Document Details & Sections (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#0F172A] border border-slate-700/80 p-6 rounded-2xl space-y-5 shadow-lg">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold font-mono text-cyan-400">
                    {selectedDoc.code}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Version {selectedDoc.version} (Reviewed {selectedDoc.lastReviewed})
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5 font-sans">
                  {selectedDoc.title}
                </h2>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#162032] p-1 rounded-lg border border-slate-700">
              {selectedDoc.sections.map((sec) => (
                <button
                  key={sec.sectionNumber}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedSection.sectionNumber === sec.sectionNumber
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Section {sec.sectionNumber}
                </button>
              ))}
            </div>

            {/* Section Body */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
                <h3 className="text-sm font-bold text-white font-sans">
                  Section {selectedSection.sectionNumber}: {selectedSection.sectionTitle}
                </h3>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                  {selectedSection.content}
                </p>
              </div>

              {/* Action Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                    Mandatory Operational Actions
                  </span>
                  <ul className="space-y-1.5 text-slate-200 text-[11px] font-sans">
                    {selectedSection.mandatoryActions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-700 space-y-2">
                  <span className="text-[10px] font-mono text-rose-400 uppercase font-bold block">
                    Escalation Criteria
                  </span>
                  <ul className="space-y-1.5 text-rose-300 text-[11px] font-sans">
                    {selectedSection.escalationThresholds.map((esc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{esc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
