import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Sidebar } from './components/Sidebar.js';
import { Topbar } from './components/Topbar.js';

// Pages
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { WhatsAppConnection } from './pages/WhatsAppConnection.js';
import { BroadcastManager } from './pages/BroadcastManager.js';
import { LiveMonitoring } from './pages/LiveMonitoring.js';
import { ExcelManager } from './pages/ExcelManager.js';
import { TemplateManager } from './pages/TemplateManager.js';
import { MediaManager } from './pages/MediaManager.js';
import { History } from './pages/History.js';
import { WhatsAppAdmin } from './pages/WhatsAppAdmin.js';
import { TerminalLogs } from './pages/TerminalLogs.js';
import { Settings } from './pages/Settings.js';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 text-slate-400 text-xs">
        Memuat aplikasi WA Blast Manager Pro...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Dashboard Utama';
      case 'whatsapp': return 'Koneksi WhatsApp Baileys';
      case 'broadcast': return 'Buat Broadcast Baru';
      case 'live-monitoring': return 'Live Monitoring Broadcast';
      case 'excel': return 'Pengelolaan Data Excel';
      case 'templates': return 'Template Pesan WhatsApp';
      case 'media': return 'Galeri Media';
      case 'history': return 'Riwayat Broadcast';
      case 'admin-bot': return 'Pengendali WhatsApp Admin';
      case 'terminal': return 'Terminal & Live Logs';
      case 'settings': return 'Pengaturan Sistem';
      default: return 'WA Blast Manager Pro';
    }
  };

  const renderCurrentPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'whatsapp':
        return <WhatsAppConnection />;
      case 'broadcast':
        return (
          <BroadcastManager
            onBroadcastCreated={(id) => {
              setSelectedBroadcastId(id);
              setCurrentTab('live-monitoring');
            }}
          />
        );
      case 'live-monitoring':
        return selectedBroadcastId ? (
          <LiveMonitoring
            broadcastId={selectedBroadcastId}
            onBack={() => setCurrentTab('history')}
          />
        ) : (
          <History
            onSelectBroadcast={(id) => {
              setSelectedBroadcastId(id);
              setCurrentTab('live-monitoring');
            }}
          />
        );
      case 'excel':
        return <ExcelManager />;
      case 'templates':
        return <TemplateManager />;
      case 'media':
        return <MediaManager />;
      case 'history':
        return (
          <History
            onSelectBroadcast={(id) => {
              setSelectedBroadcastId(id);
              setCurrentTab('live-monitoring');
            }}
          />
        );
      case 'admin-bot':
        return <WhatsAppAdmin />;
      case 'terminal':
        return <TerminalLogs />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100 flex transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Top Header Bar */}
        <Topbar
          title={getPageTitle()}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onNavigateToWhatsApp={() => setCurrentTab('whatsapp')}
        />

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};
