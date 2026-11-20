import React from 'react';
import { Menu, Sun, Moon, AlertTriangle, ShieldCheck, QrCode } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import { useSocket } from '../context/SocketContext.js';

interface TopbarProps {
  onMenuToggle: () => void;
  title: string;
  onNavigateToWhatsApp?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuToggle, title, onNavigateToWhatsApp }) => {
  const { theme, toggleTheme } = useTheme();
  const { waStatus } = useSocket();

  return (
    <header className="h-20 bg-white/80 dark:bg-navy-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
        >
          <Menu size={22} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
            Dashboard Kontrol & Otomatisasi Broadcast WhatsApp
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* WhatsApp Status Badge Button */}
        <button
          onClick={onNavigateToWhatsApp}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            waStatus.status === 'connected'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : waStatus.status === 'connecting'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              waStatus.status === 'connected'
                ? 'bg-emerald-500'
                : waStatus.status === 'connecting'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {waStatus.status === 'connected'
              ? `WA Aktif (${waStatus.phone || 'Terhubung'})`
              : waStatus.status === 'connecting'
              ? 'Menghubungkan...'
              : 'WA Belum Terhubung'}
          </span>
          <span className="sm:hidden">{waStatus.status === 'connected' ? 'ON' : 'OFF'}</span>
          <QrCode size={13} className="opacity-70" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
