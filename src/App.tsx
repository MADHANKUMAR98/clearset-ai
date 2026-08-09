import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './views/DashboardView';
import { ExceptionsView } from './views/ExceptionsView';
import { InvestigationView } from './views/InvestigationView';
import { CopilotView } from './views/CopilotView';
import { CasesView } from './views/CasesView';
import { PoliciesView } from './views/PoliciesView';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[#070B12]">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'exceptions' && <ExceptionsView />}
          {activeTab === 'investigation' && <InvestigationView />}
          {activeTab === 'copilot' && <CopilotView />}
          {activeTab === 'cases' && <CasesView />}
          {activeTab === 'policies' && <PoliciesView />}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
