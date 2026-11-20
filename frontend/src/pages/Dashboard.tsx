import React, { useEffect, useState } from 'react';
import {
  Radio,
  Users,
  Send,
  CheckCircle,
  XCircle,
  SkipForward,
  PlayCircle,
  PauseCircle,
  Cpu,
  ArrowUpRight,
  PlusCircle,
  Upload,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { StatCard } from '../components/StatCard.js';
import { api } from '../services/api.js';
import { useSocket } from '../context/SocketContext.js';
import { Broadcast } from '../types/index.js';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { waStatus, latestBroadcastProgress } = useSocket();
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, chartRes, recentRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/chart'),
        api.get('/dashboard/recent-broadcasts')
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (chartRes.data?.success) setChartData(chartRes.data.data);
      if (recentRes.data?.success) setRecentBroadcasts(recentRes.data.data);
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Update counters if real-time broadcast progress comes through socket
  useEffect(() => {
    if (latestBroadcastProgress) {
      setStats((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: {
            ...prev.messages,
            sent: latestBroadcastProgress.sent_count,
            failed: latestBroadcastProgress.failed_count,
            skipped: latestBroadcastProgress.skipped_count,
            pending: latestBroadcastProgress.pending_count
          }
        };
      });
    }
  }, [latestBroadcastProgress]);

  return (
    <div className="space-y-6">
      {/* Emergency Stop Banner if Active */}
      {stats?.emergencyStop && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="animate-bounce" size={22} />
            <div>
              <h4 className="font-bold text-sm">EMERGENCY STOP SEDANG AKTIF!</h4>
              <p className="text-xs opacity-90">Seluruh antrean broadcast dijeda darurat. Buka Pengaturan untuk menonaktifkan.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
          >
            Buka Pengaturan
          </button>
        </div>
      )}

      {/* Quick Action Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/15">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Selamat Datang di WA Blast Manager Pro</h2>
          <p className="text-xs text-brand-100 font-medium mt-0.5">
            Kelola pengiriman massal WhatsApp dengan personalisasi pesan berbasis Excel & Baileys
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => onNavigate('broadcast')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-brand-700 font-bold text-xs shadow-md hover:bg-brand-50 transition"
          >
            <PlusCircle size={16} />
            <span>Buat Broadcast</span>
          </button>
          <button
            onClick={() => onNavigate('excel')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-sm transition"
          >
            <Upload size={16} />
            <span>Impor Excel</span>
          </button>
        </div>
      </div>

      {/* 10 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. WhatsApp Connection */}
        <StatCard
          title="Status WhatsApp"
          value={waStatus.status === 'connected' ? 'Terhubung' : waStatus.status === 'connecting' ? 'Koneksi...' : 'Terputus'}
          subtext={waStatus.phone ? `+${waStatus.phone}` : 'Scan QR code untuk mulai'}
          icon={Radio}
          color={waStatus.status === 'connected' ? 'emerald' : waStatus.status === 'connecting' ? 'amber' : 'rose'}
          onClick={() => onNavigate('whatsapp')}
        />

        {/* 2. Total Contacts */}
        <StatCard
          title="Total Kontak"
          value={stats?.contacts?.total || 0}
          subtext={`${stats?.contacts?.valid || 0} kontak valid terverifikasi`}
          icon={Users}
          color="blue"
          onClick={() => onNavigate('excel')}
        />

        {/* 3. Messages Queued / Pending */}
        <StatCard
          title="Pesan Dalam Antrean"
          value={stats?.messages?.pending || 0}
          subtext="Menunggu diproses worker"
          icon={Send}
          color="indigo"
          onClick={() => onNavigate('broadcast')}
        />

        {/* 4. Sent Successfully */}
        <StatCard
          title="Pesan Berhasil"
          value={stats?.messages?.sent || 0}
          subtext="Terkirim ke WhatsApp penerima"
          icon={CheckCircle}
          color="emerald"
        />

        {/* 5. Failed Messages */}
        <StatCard
          title="Pesan Gagal"
          value={stats?.messages?.failed || 0}
          subtext="Nomor tidak valid / error WA"
          icon={XCircle}
          color="rose"
        />

        {/* 6. Skipped Messages */}
        <StatCard
          title="Pesan Dilewati"
          value={stats?.messages?.skipped || 0}
          subtext="Opt-out atau tanpa consent"
          icon={SkipForward}
          color="amber"
        />

        {/* 7. Running Broadcasts */}
        <StatCard
          title="Broadcast Berjalan"
          value={stats?.broadcasts?.running || 0}
          subtext="Sedang diproses saat ini"
          icon={PlayCircle}
          color="emerald"
          onClick={() => onNavigate('history')}
        />

        {/* 8. Paused Broadcasts */}
        <StatCard
          title="Broadcast Dijeda"
          value={stats?.broadcasts?.paused || 0}
          subtext="Menunggu dilanjutkan admin"
          icon={PauseCircle}
          color="amber"
          onClick={() => onNavigate('history')}
        />

        {/* 9. Server RAM Usage */}
        <StatCard
          title="Penggunaan RAM"
          value={`${stats?.server?.memoryPercent || 0}%`}
          subtext={`${stats?.server?.usedMemoryMb || 0} MB / ${stats?.server?.totalMemoryMb || 0} MB`}
          icon={Cpu}
          color="blue"
          onClick={() => onNavigate('terminal')}
        />

        {/* 10. Server Uptime */}
        <StatCard
          title="Uptime Server"
          value={`${stats?.server?.uptimeHours || 0} Jam`}
          subtext="Server berjalan stabil"
          icon={RefreshCw}
          color="slate"
          onClick={() => onNavigate('terminal')}
        />
      </div>

      {/* Main Content Grid: Activity Chart & Recent Broadcasts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Aktivitas Pengiriman Pesan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Volume pengiriman berhasil vs gagal selama 7 hari terakhir
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                <span className="text-slate-600 dark:text-slate-300">Berhasil</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300">Gagal</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '12px',
                    border: '1px solid #1E293B',
                    color: '#FFF',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="sent" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="failed" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live / Recent Broadcast Card (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Broadcast Terbaru</h3>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center space-x-1"
              >
                <span>Lihat Semua</span>
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {recentBroadcasts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Belum ada aktivitas broadcast.
                </div>
              ) : (
                recentBroadcasts.slice(0, 4).map((b) => {
                  const percent = b.total_recipients > 0 ? Math.round(((b.sent_count + b.failed_count + b.skipped_count) / b.total_recipients) * 100) : 0;
                  return (
                    <div
                      key={b.id}
                      onClick={() => onNavigate('history')}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/40 hover:border-brand-300 dark:hover:border-brand-700 cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {b.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            b.status === 'running'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse'
                              : b.status === 'paused'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : b.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-2">
                        <div
                          className="bg-brand-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{b.sent_count} / {b.total_recipients} Terkirim</span>
                        <span className="font-semibold">{percent}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('broadcast')}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
          >
            <Send size={14} />
            <span>Mulai Broadcast Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
