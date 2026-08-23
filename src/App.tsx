import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 flex flex-col font-sans">
      <Navbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex flex-1">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-[#070B12] min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'exceptions' && <ExceptionsView />}
              {activeTab === 'investigation' && <InvestigationView />}
              {activeTab === 'copilot' && <CopilotView />}
              {activeTab === 'cases' && <CasesView />}
              {activeTab === 'policies' && <PoliciesView />}
            </motion.div>
          </AnimatePresence>
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
