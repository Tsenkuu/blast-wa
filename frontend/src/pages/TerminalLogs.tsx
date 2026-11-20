import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Cpu,
  Server,
  Activity,
  Power
} from 'lucide-react';
import { api } from '../services/api.js';
import { useSocket } from '../context/SocketContext.js';
import { SystemLog } from '../types/index.js';

export const TerminalLogs: React.FC = () => {
  const { logs: socketLogs, clearLogs: clearSocketLogs } = useSocket();
  const [dbLogs, setDbLogs] = useState<SystemLog[]>([]);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchInitialLogs = async () => {
    try {
      const [logsRes, metricsRes] = await Promise.all([
        api.get('/logs/system?limit=100'),
        api.get('/logs/server-metrics')
      ]);
      if (logsRes.data?.success) setDbLogs(logsRes.data.data);
      if (metricsRes.data?.success) setMetrics(metricsRes.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInitialLogs();
    const interval = setInterval(fetchInitialLogs, 8000);
    return () => clearInterval(interval);
  }, []);

  // Merge Socket live logs with DB logs
  const allLogs = [...socketLogs, ...dbLogs];
  // Deduplicate by message + timestamp or id
  const seen = new Set();
  const uniqueLogs = allLogs.filter((item) => {
    const key = `${item.id || ''}_${item.created_at || item.timestamp}_${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filteredLogs = uniqueLogs.filter((log) => {
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleRestartWA = async () => {
    if (!confirm('Restart koneksi WhatsApp?')) return;
    setActionLoading('wa');
    try {
      await api.post('/whatsapp/restart');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartWorker = async () => {
    if (!confirm('Restart antrean background worker?')) return;
    setActionLoading('worker');
    try {
      await api.post('/logs/restart-worker');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadLogs = () => {
    window.open('/api/logs/download', '_blank');
  };

  const handleClear = async () => {
    clearSocketLogs();
    try {
      await api.delete('/logs/system');
      setDbLogs([]);
    } catch (e) {
      console.error(e);
    }
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-emerald-400 font-bold';
      case 'WARNING':
        return 'text-amber-400 font-bold';
      case 'ERROR':
        return 'text-rose-400 font-bold';
      default:
        return 'text-sky-400 font-bold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Terminal & Live Logs</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Pemantauan real-time streaming konsol sistem, worker background, dan kesehatan server
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRestartWA}
              disabled={actionLoading === 'wa'}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center space-x-1.5"
            >
              <RefreshCw size={14} className={actionLoading === 'wa' ? 'animate-spin' : ''} />
              <span>Restart WhatsApp</span>
            </button>
            <button
              onClick={handleRestartWorker}
              disabled={actionLoading === 'worker'}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center space-x-1.5"
            >
              <Power size={14} className={actionLoading === 'worker' ? 'animate-spin' : ''} />
              <span>Restart Worker</span>
            </button>
          </div>
        </div>

        {/* Server Metrics Bar */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <Server size={16} className="text-brand-500" />
              <div>
                <span className="text-slate-400 text-[10px] block">Sistem Operasi</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics.platform}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Cpu size={16} className="text-indigo-500" />
              <div>
                <span className="text-slate-400 text-[10px] block">CPU ({metrics.cpuCores} Cores)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block max-w-[140px]">
                  {metrics.cpuModel}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Activity size={16} className="text-emerald-500" />
              <div>
                <span className="text-slate-400 text-[10px] block">Penggunaan RAM</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {metrics.usedMemoryMb} MB / {metrics.totalMemoryMb} MB ({metrics.memoryPercent}%)
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <RefreshCw size={16} className="text-amber-500" />
              <div>
                <span className="text-slate-400 text-[10px] block">Server Uptime</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics.uptimeFormatted}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal View Box */}
      <div className="rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl overflow-hidden font-['JetBrains_Mono',monospace]">
        {/* Terminal Header Bar */}
        <div className="px-5 py-3.5 bg-[#121827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-400 ml-2 font-bold tracking-tight">system@wa-blast-pro:~$</span>
          </div>

          {/* Filter & Actions */}
          <div className="flex items-center space-x-2 text-xs">
            {['ALL', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  levelFilter === lvl
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {lvl}
              </button>
            ))}

            <div className="relative ml-2">
              <Search size={12} className="absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari log..."
                className="pl-7 pr-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
              />
            </div>

            <button
              onClick={handleDownloadLogs}
              title="Unduh Seluruh Log"
              className="p-1 text-slate-400 hover:text-white"
            >
              <Download size={15} />
            </button>
            <button
              onClick={handleClear}
              title="Bersihkan Tampilan"
              className="p-1 text-slate-400 hover:text-rose-400"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Terminal Screen Body */}
        <div
          ref={terminalRef}
          className="p-5 h-[500px] overflow-y-auto space-y-1.5 text-xs text-slate-300 leading-relaxed font-mono select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 py-10 text-center italic">
              -- Tidak ada log yang cocok dengan filter --
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const time = log.created_at
                ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour12: false })
                : log.timestamp || '00:00:00';

              return (
                <div key={index} className="flex items-start space-x-2 hover:bg-slate-900/60 px-1 py-0.5 rounded">
                  <span className="text-slate-500 select-none">[{time}]</span>
                  <span className={getLevelStyle(log.level)}>[{log.level}]</span>
                  <span className="text-amber-300/90 font-semibold">{log.module}:</span>
                  <span className="text-slate-200 flex-1">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
