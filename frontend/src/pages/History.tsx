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
  Download,
  Sliders,
  Clock,
  MessageSquare,
  X,
  Check
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

  // Ubah Jeda Modal State
  const [selectedBroadcastForDelay, setSelectedBroadcastForDelay] = useState<Broadcast | null>(null);
  const [editDelaySeconds, setEditDelaySeconds] = useState(4);
  const [savingDelay, setSavingDelay] = useState(false);
  const [delaySuccessMsg, setDelaySuccessMsg] = useState<string | null>(null);

  // Quick Action Loading
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);

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

  const handleRowPause = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setRowActionLoading(`pause-${id}`);
    try {
      await api.post(`/broadcasts/${id}/pause`);
      fetchBroadcasts();
    } catch (err) {
      console.error(err);
    } finally {
      setRowActionLoading(null);
    }
  };

  const handleRowResume = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setRowActionLoading(`resume-${id}`);
    try {
      await api.post(`/broadcasts/${id}/resume`);
      fetchBroadcasts();
    } catch (err) {
      console.error(err);
    } finally {
      setRowActionLoading(null);
    }
  };

  const handleOpenDelayModal = (e: React.MouseEvent, b: Broadcast) => {
    e.stopPropagation();
    setSelectedBroadcastForDelay(b);
    setEditDelaySeconds(b.delay_seconds || 4);
    setDelaySuccessMsg(null);
  };

  const handleSaveDelay = async () => {
    if (!selectedBroadcastForDelay) return;
    setSavingDelay(true);
    setDelaySuccessMsg(null);
    try {
      const res = await api.patch(`/broadcasts/${selectedBroadcastForDelay.id}/delay`, {
        delaySeconds: editDelaySeconds
      });
      if (res.data?.success) {
        setDelaySuccessMsg(`Jeda berhasil diubah menjadi ${editDelaySeconds} detik/pesan!`);
        fetchBroadcasts();
        setTimeout(() => {
          setSelectedBroadcastForDelay(null);
          setDelaySuccessMsg(null);
        }, 1200);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah jeda');
    } finally {
      setSavingDelay(false);
    }
  };

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
          Arsip lengkap seluruh kampanye broadcast, atur jeda antar nomor, pantau status terkirim/belum, dan kirim pesan WA
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
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Memuat riwayat broadcast...</div>
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
                  <th className="py-3 px-4 text-center">Jeda / Interval</th>
                  <th className="py-3 px-4">Progres Pengiriman</th>
                  <th className="py-3 px-4 text-center">Berhasil</th>
                  <th className="py-3 px-4 text-center">Belum / Gagal</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((b) => {
                  const processed = (b.sent_count || 0) + (b.failed_count || 0) + (b.skipped_count || 0);
                  const percent = b.total_recipients > 0 ? Math.round((processed / b.total_recipients) * 100) : 0;
                  const delaySec = b.delay_seconds || 4;

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

                      {/* Jeda Column with quick edit trigger */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => handleOpenDelayModal(e, b)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-bold text-[11px] inline-flex items-center space-x-1 transition"
                          title="Klik untuk mengubah jeda per nomor"
                        >
                          <Clock size={11} />
                          <span>{delaySec}s {delaySec >= 60 ? `(${(delaySec / 60).toFixed(1).replace('.0', '')}m)` : ''}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 w-40">
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
                      <td className="py-3 px-4 text-center font-medium text-slate-500 dark:text-slate-400">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{b.pending_count || 0}</span> /{' '}
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{b.failed_count || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {b.started_at ? new Date(b.started_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Quick Pause/Resume button */}
                          {b.status === 'running' && (
                            <button
                              onClick={(e) => handleRowPause(e, b.id)}
                              disabled={rowActionLoading === `pause-${b.id}`}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 transition"
                              title="Jeda Pengiriman"
                            >
                              <Pause size={13} />
                            </button>
                          )}
                          {b.status === 'paused' && (
                            <button
                              onClick={(e) => handleRowResume(e, b.id)}
                              disabled={rowActionLoading === `resume-${b.id}`}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 transition"
                              title="Lanjutkan Pengiriman"
                            >
                              <Play size={13} />
                            </button>
                          )}

                          {/* Ubah Jeda */}
                          <button
                            onClick={(e) => handleOpenDelayModal(e, b)}
                            className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1 transition"
                            title="Ubah jeda waktu blast"
                          >
                            <Sliders size={12} />
                            <span>Jeda</span>
                          </button>

                          {/* Pantau & Chat WA */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBroadcast(b.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center space-x-1 transition border border-brand-200 dark:border-brand-900/50"
                          >
                            <MessageSquare size={13} />
                            <span>Pantau & WA</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Canggih Ubah Jeda Blast Langsung */}
      {selectedBroadcastForDelay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Sliders size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ubah Jeda Pengiriman Pernomor
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Broadcast: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedBroadcastForDelay.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBroadcastForDelay(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {delaySuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center space-x-2">
                <Check size={16} />
                <span>{delaySuccessMsg}</span>
              </div>
            )}

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Pilihan Cepat Jeda Interval
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { s: 3, label: '3 Detik' },
                  { s: 5, label: '5 Detik' },
                  { s: 10, label: '10 Detik' },
                  { s: 15, label: '15 Detik' },
                  { s: 30, label: '30 Detik' },
                  { s: 60, label: '1 Menit' },
                  { s: 120, label: '2 Menit' },
                  { s: 300, label: '5 Menit' }
                ].map((preset) => (
                  <button
                    key={preset.s}
                    type="button"
                    onClick={() => setEditDelaySeconds(preset.s)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center ${
                      editDelaySeconds === preset.s
                        ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-400'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Atur Detik Kustom (1 - 600 Detik)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={editDelaySeconds}
                  onChange={(e) => setEditDelaySeconds(Math.max(1, Math.min(600, parseInt(e.target.value || '1', 10))))}
                  className="w-32 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-bold text-sm text-center"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  detik {editDelaySeconds >= 60 ? `(${(editDelaySeconds / 60).toFixed(1).replace('.0', '')} menit)` : ''}
                </span>
              </div>
            </div>

            {/* Dynamic ETA Simulation Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Clock size={14} className="text-brand-600" />
                <span>Simulasi Waktu Sisa:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Dengan jeda <strong>{editDelaySeconds} detik/pesan</strong>, sebanyak <strong>{selectedBroadcastForDelay.pending_count || 0} nomor tersisa</strong> diperkirakan selesai dalam <strong>~{Math.ceil(((selectedBroadcastForDelay.pending_count || 0) * editDelaySeconds) / 60)} menit</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBroadcastForDelay(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveDelay}
                disabled={savingDelay}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {savingDelay ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Terapkan Jeda Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
