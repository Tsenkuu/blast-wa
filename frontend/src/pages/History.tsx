import React, { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  Search,
  Filter,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Download
} from 'lucide-react';
import { api } from '../services/api.js';
import { Broadcast } from '../types/index.js';

interface HistoryProps {
  onSelectBroadcast: (id: number) => void;
}

export const History: React.FC<HistoryProps> = ({ onSelectBroadcast }) => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/broadcasts?status=${statusFilter}`);
      if (res.data?.success) {
        setBroadcasts(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, [statusFilter]);

  const filtered = broadcasts.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.broadcast_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Riwayat & Log Broadcast</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          Arsip lengkap seluruh kampanye broadcast, statistik penerima berhasil/gagal, dan live monitoring
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="running">Sedang Berjalan</option>
              <option value="paused">Dijeda</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
              <option value="failed">Gagal</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau kode broadcast..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs w-64"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Memuat riwayat...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Tidak ada riwayat broadcast yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Nama Broadcast</th>
                  <th className="py-3 px-4">Dataset Target</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progres Pengiriman</th>
                  <th className="py-3 px-4 text-center">Berhasil</th>
                  <th className="py-3 px-4 text-center">Gagal</th>
                  <th className="py-3 px-4">Waktu Mulai</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((b) => {
                  const processed = (b.sent_count || 0) + (b.failed_count || 0) + (b.skipped_count || 0);
                  const percent = b.total_recipients > 0 ? Math.round((processed / b.total_recipients) * 100) : 0;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition cursor-pointer"
                      onClick={() => onSelectBroadcast(b.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{b.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{b.broadcast_code}</div>
                      </td>
                      <td className="py-3 px-4 font-medium">{b.dataset_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            b.status === 'running'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 animate-pulse'
                              : b.status === 'paused'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                              : b.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                              : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 w-44">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
                          <div
                            className="bg-brand-600 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>{processed}/{b.total_recipients}</span>
                          <span>{percent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {b.sent_count}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                        {b.failed_count}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {b.started_at ? new Date(b.started_at).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBroadcast(b.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center space-x-1.5 ml-auto"
                        >
                          <Eye size={14} />
                          <span>Pantau</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
