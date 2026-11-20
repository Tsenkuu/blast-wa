import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  XOctagon,
  RotateCcw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  FileSpreadsheet,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api.js';
import { useSocket } from '../context/SocketContext.js';
import { Broadcast, Recipient } from '../types/index.js';

interface LiveMonitoringProps {
  broadcastId: number;
  onBack: () => void;
}

export const LiveMonitoring: React.FC<LiveMonitoringProps> = ({ broadcastId, onBack }) => {
  const { latestBroadcastProgress } = useSocket();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecipientsCount, setTotalRecipientsCount] = useState(0);

  // Action Loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch Broadcast Details
  const fetchBroadcast = async () => {
    try {
      const res = await api.get(`/broadcasts/${broadcastId}`);
      if (res.data?.success) {
        setBroadcast(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch broadcast:', err);
    }
  };

  // Fetch Recipients Table
  const fetchRecipients = async () => {
    try {
      const res = await api.get(
        `/broadcasts/${broadcastId}/recipients?status=${statusFilter}&search=${searchQuery}&page=${page}&limit=20`
      );
      if (res.data?.success) {
        setRecipients(res.data.data.recipients);
        setTotalPages(res.data.data.pagination.totalPages);
        setTotalRecipientsCount(res.data.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcast();
    fetchRecipients();
    const interval = setInterval(() => {
      fetchBroadcast();
      fetchRecipients();
    }, 4000);
    return () => clearInterval(interval);
  }, [broadcastId, statusFilter, searchQuery, page]);

  // Update real-time progress from Socket.IO
  useEffect(() => {
    if (latestBroadcastProgress && latestBroadcastProgress.id === broadcastId) {
      setBroadcast((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: latestBroadcastProgress.status as any,
          sent_count: latestBroadcastProgress.sent_count,
          failed_count: latestBroadcastProgress.failed_count,
          skipped_count: latestBroadcastProgress.skipped_count,
          pending_count: latestBroadcastProgress.pending_count
        };
      });
    }
  }, [latestBroadcastProgress, broadcastId]);

  // Control Actions
  const handlePause = async () => {
    setActionLoading('pause');
    try {
      await api.post(`/broadcasts/${broadcastId}/pause`);
      fetchBroadcast();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      await api.post(`/broadcasts/${broadcastId}/resume`);
      fetchBroadcast();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan broadcast ini?')) return;
    setActionLoading('cancel');
    try {
      await api.post(`/broadcasts/${broadcastId}/cancel`);
      fetchBroadcast();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading('retry');
    try {
      await api.post(`/broadcasts/${broadcastId}/retry-failed`);
      fetchBroadcast();
      fetchRecipients();
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/broadcasts/${broadcastId}/export`, '_blank');
  };

  if (!broadcast) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat data broadcast...</div>;
  }

  const processed = (broadcast.sent_count || 0) + (broadcast.failed_count || 0) + (broadcast.skipped_count || 0);
  const percent = broadcast.total_recipients > 0 ? Math.round((processed / broadcast.total_recipients) * 100) : 0;

  // Approximate ETA based on configured delay_seconds
  const delayPerMsg = broadcast.delay_seconds || 4;
  const remainingSeconds = (broadcast.pending_count || 0) * delayPerMsg;
  const etaMinutes = Math.ceil(remainingSeconds / 60);

  return (
    <div className="space-y-6">
      {/* Top Header with Back Button & Actions */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{broadcast.name}</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    broadcast.status === 'running'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 animate-pulse'
                      : broadcast.status === 'paused'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : broadcast.status === 'completed'
                      ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {broadcast.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Kode: <span className="font-mono">{broadcast.broadcast_code}</span> | Dataset: {broadcast.dataset_name || 'Excel'} | Jeda: <span className="font-bold text-brand-600 dark:text-brand-400">{delayPerMsg} detik/pesan</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {broadcast.status === 'running' && (
              <button
                onClick={handlePause}
                disabled={actionLoading === 'pause'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Pause size={14} />
                <span>Jeda</span>
              </button>
            )}

            {broadcast.status === 'paused' && (
              <button
                onClick={handleResume}
                disabled={actionLoading === 'resume'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Play size={14} />
                <span>Lanjutkan</span>
              </button>
            )}

            {['running', 'paused', 'queued'].includes(broadcast.status) && (
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <XOctagon size={14} />
                <span>Batalkan</span>
              </button>
            )}

            {broadcast.failed_count > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={actionLoading === 'retry'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <RotateCcw size={14} />
                <span>Retry Gagal ({broadcast.failed_count})</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Real-time Progress Bar Card */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Progres Pengiriman: {processed} dari {broadcast.total_recipients} Pesan ({percent}%)
            </span>
            {broadcast.status === 'running' && (
              <span className="text-brand-600 dark:text-brand-400 font-semibold flex items-center space-x-1">
                <Clock size={13} />
                <span>Estimasi Sisa Waktu: ~{etaMinutes} menit</span>
              </span>
            )}
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* 5 Stats Counter Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Total Target</span>
              <span className="font-bold text-slate-800 dark:text-white text-base">{broadcast.total_recipients}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] block">Berhasil</span>
              <span className="font-bold text-base">{broadcast.sent_count}</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
              <span className="text-[10px] block">Gagal</span>
              <span className="font-bold text-base">{broadcast.failed_count}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <span className="text-[10px] block">Dilewati</span>
              <span className="font-bold text-base">{broadcast.skipped_count}</span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-[10px] block">Menunggu</span>
              <span className="font-bold text-base">{broadcast.pending_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recipient Logs Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        {/* Table Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="sent">Berhasil</option>
              <option value="failed">Gagal</option>
              <option value="skipped">Dilewati</option>
              <option value="pending">Menunggu</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama / nomor telepon..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs w-64"
            />
          </div>
        </div>

        {/* Recipients Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nama Kontak</th>
                <th className="py-2.5 px-3">Nomor WhatsApp</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Waktu Terkirim</th>
                <th className="py-2.5 px-3">Keterangan / Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada penerima dengan filter ini.
                  </td>
                </tr>
              ) : (
                recipients.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-400">{(page - 1) * 20 + idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {r.recipient_name || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{r.phone_number}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          r.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : r.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                            : r.status === 'skipped'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            : r.status === 'processing'
                            ? 'bg-brand-500/20 text-brand-700 dark:text-brand-400 animate-pulse'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {r.sent_at ? new Date(r.sent_at).toLocaleTimeString('id-ID') : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {r.error_reason || (r.status === 'sent' ? 'Pesan berhasil terkirim' : '-')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Total {totalRecipientsCount} kontak | Halaman {page} dari {totalPages || 1}
          </span>
          <div className="flex space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
