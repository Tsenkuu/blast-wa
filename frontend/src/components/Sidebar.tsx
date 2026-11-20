import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Send,
  FileSpreadsheet,
  FileText,
  Image,
  History,
  Bot,
  Terminal,
  Settings,
  LogOut,
  Radio,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const { waStatus } = useSocket();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'whatsapp', label: 'Koneksi WhatsApp', icon: QrCode, badge: waStatus.status },
    { id: 'broadcast', label: 'Broadcast Manager', icon: Send },
    { id: 'excel', label: 'Data Excel', icon: FileSpreadsheet },
    { id: 'templates', label: 'Template Pesan', icon: FileText },
    { id: 'media', label: 'Media Manager', icon: Image },
    { id: 'history', label: 'Riwayat Broadcast', icon: History },
    { id: 'admin-bot', label: 'WhatsApp Admin', icon: Bot },
    { id: 'terminal', label: 'Terminal & Logs', icon: Terminal },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const getWaStatusColor = () => {
    switch (waStatus.status) {
      case 'connected': return 'bg-emerald-500';
      case 'connecting': return 'bg-amber-500 animate-pulse';
      case 'logged_out': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-navy-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-2xl lg:shadow-none`}
      >
        {/* Brand Header */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800/80 bg-navy-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-black text-xl">
              W
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight tracking-tight">
                WA BLAST PRO
              </h1>
              <p className="text-xs text-brand-400 font-medium">Enterprise Automation</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* WhatsApp Connection Status Indicator */}
        <div className="px-5 py-4 m-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Radio size={13} className={waStatus.status === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
              WhatsApp Bot
            </span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${getWaStatusColor()}`} />
          </div>
          <div className="font-semibold text-slate-200 text-sm truncate">
            {waStatus.status === 'connected' ? (
              waStatus.name || waStatus.phone || 'Terhubung'
            ) : waStatus.status === 'connecting' ? (
              'Menghubungkan...'
            ) : waStatus.status === 'logged_out' ? (
              'Keluar (Logout)'
            ) : (
              'Terputus'
            )}
          </div>
          {waStatus.phone && waStatus.status === 'connected' && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">+{waStatus.phone}</div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'whatsapp' && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      waStatus.status === 'connected'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {waStatus.status === 'connected' ? 'ON' : 'OFF'}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-navy-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-brand-700/80 border border-brand-500/40 text-white font-bold flex items-center justify-center text-sm shadow">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="truncate">
                <div className="text-sm font-semibold text-white truncate">{user?.fullName || 'Admin'}</div>
                <div className="text-[11px] text-brand-300/80 font-medium capitalize">{user?.roleName || 'Super Admin'}</div>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
