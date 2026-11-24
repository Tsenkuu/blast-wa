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
  ArrowLeft,
  Sliders,
  MessageSquare,
  Send,
  CheckCheck,
  ExternalLink,
  Phone,
  User,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  X
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

  // Dynamic Delay Modal State
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [customDelaySeconds, setCustomDelaySeconds] = useState(4);
  const [savingDelay, setSavingDelay] = useState(false);
  const [delayNotice, setDelayNotice] = useState<string | null>(null);

  // WhatsApp Chat Simulator Modal / Drawer State
  const [activeChatRecipient, setActiveChatRecipient] = useState<Recipient | null>(null);
  const [directMsgText, setDirectMsgText] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string; status: 'sent' | 'pending' | 'failed' }>>([]);
  const [directSendSuccess, setDirectSendSuccess] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Fetch Broadcast Details
  const fetchBroadcast = async () => {
    try {
      const res = await api.get(`/broadcasts/${broadcastId}`);
      if (res.data?.success) {
        setBroadcast(res.data.data);
        if (res.data.data.delay_seconds) {
          setCustomDelaySeconds(res.data.data.delay_seconds);
        }
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

  // Dynamic Delay Update
  const handleSaveDelay = async () => {
    setSavingDelay(true);
    setDelayNotice(null);
    try {
      const res = await api.patch(`/broadcasts/${broadcastId}/delay`, {
        delaySeconds: customDelaySeconds
      });
      if (res.data?.success) {
        setDelayNotice(`Jeda berhasil diubah menjadi ${customDelaySeconds} detik/pesan!`);
        fetchBroadcast();
        setTimeout(() => {
          setShowDelayModal(false);
          setDelayNotice(null);
        }, 1200);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah jeda');
    } finally {
      setSavingDelay(false);
    }
  };

  // Open WA Chat Simulator
  const handleOpenWAChat = (r: Recipient) => {
    setActiveChatRecipient(r);
    setDirectMsgText('');
    setDirectSendSuccess(null);
    // Initialize chat messages with the personalized template
    setChatHistory([
      {
        sender: 'bot',
        text: r.personalized_message || 'Pesan WhatsApp otomatis',
        time: r.sent_at ? new Date(r.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: (r.status === 'sent' ? 'sent' : r.status === 'failed' ? 'failed' : 'pending') as any
      }
    ]);
  };

  // Send Direct Message from WA Simulator
  const handleSendDirectMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChatRecipient || !directMsgText.trim()) return;

    setSendingDirect(true);
    setDirectSendSuccess(null);
    try {
      const res = await api.post(`/broadcasts/${broadcastId}/recipients/${activeChatRecipient.id}/send-now`, {
        customMessage: directMsgText
      });

      if (res.data?.success) {
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setChatHistory((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: directMsgText,
            time: now,
            status: 'sent'
          }
        ]);
        setDirectMsgText('');
        setDirectSendSuccess('Pesan WhatsApp terkirim langsung!');
        fetchBroadcast();
        fetchRecipients();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim pesan langsung');
    } finally {
      setSendingDirect(false);
    }
  };

  // Send Now for single recipient from table
  const handleSendNowDirect = async (recipientId: number) => {
    setActionLoading(`send-${recipientId}`);
    try {
      const res = await api.post(`/broadcasts/${broadcastId}/recipients/${recipientId}/send-now`, {});
      if (res.data?.success) {
        fetchBroadcast();
        fetchRecipients();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim pesan');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  if (!broadcast) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat data broadcast...</div>;
  }

  const processed = (broadcast.sent_count || 0) + (broadcast.failed_count || 0) + (broadcast.skipped_count || 0);
  const percent = broadcast.total_recipients > 0 ? Math.round((processed / broadcast.total_recipients) * 100) : 0;

  // Approximate ETA based on configured delay_seconds
  const delayPerMsg = broadcast.delay_seconds || customDelaySeconds || 4;
  const remainingSeconds = (broadcast.pending_count || 0) * delayPerMsg;
  const etaMinutes = Math.ceil(remainingSeconds / 60);

  return (
    <div className="space-y-6">
      {/* Top Header with Back Button & Actions */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Kembali ke Riwayat"
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
                Kode: <span className="font-mono">{broadcast.broadcast_code}</span> | Dataset: {broadcast.dataset_name || 'Excel'} | Jeda Antar Nomor:{' '}
                <span className="font-bold text-brand-600 dark:text-brand-400">{delayPerMsg} detik ({delayPerMsg >= 60 ? `${(delayPerMsg / 60).toFixed(1).replace('.0', '')} menit` : `${delayPerMsg}s`})</span>
              </p>
            </div>
          </div>

          {/* Action Buttons: Pause, Resume, Change Delay, Export, Retry */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ubah Jeda Pernomor Button (Fitur Canggih) */}
            <button
              onClick={() => {
                setCustomDelaySeconds(delayPerMsg);
                setShowDelayModal(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 font-bold text-xs shadow-sm transition"
              title="Ubah jangka waktu jeda pernomor langsung on-the-fly"
            >
              <Sliders size={14} />
              <span>Ubah Jeda ({delayPerMsg}s)</span>
            </button>

            {/* Jeda */}
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

            {/* Lanjutkan */}
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

            {/* Batalkan */}
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

            {/* Retry Gagal */}
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

            {/* Export CSV */}
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
                <span>Estimasi Selesai: ~{etaMinutes} menit (Jeda: {delayPerMsg}s/nomor)</span>
              </span>
            )}
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* 5 Stats Counter Grid with Interactive Filter trigger */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-center text-xs">
            <div
              onClick={() => { setStatusFilter('all'); setPage(1); }}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 font-bold ring-2 ring-brand-500/20'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <span className="text-[10px] text-slate-400 block font-normal">Semua Target</span>
              <span className="font-bold text-base">{broadcast.total_recipients}</span>
            </div>

            <div
              onClick={() => { setStatusFilter('sent'); setPage(1); }}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300'
              }`}
            >
              <span className="text-[10px] block font-normal">Telah Di-Blast</span>
              <span className="font-bold text-base">{broadcast.sent_count}</span>
            </div>

            <div
              onClick={() => { setStatusFilter('pending'); setPage(1); }}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-800 dark:text-indigo-300 font-bold ring-2 ring-indigo-500/20'
                  : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40 hover:border-indigo-300'
              }`}
            >
              <span className="text-[10px] block font-normal">Belum Di-Blast</span>
              <span className="font-bold text-base">{broadcast.pending_count}</span>
            </div>

            <div
              onClick={() => { setStatusFilter('failed'); setPage(1); }}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-300 font-bold ring-2 ring-rose-500/20'
                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/40 hover:border-rose-300'
              }`}
            >
              <span className="text-[10px] block font-normal">Gagal</span>
              <span className="font-bold text-base">{broadcast.failed_count}</span>
            </div>

            <div
              onClick={() => { setStatusFilter('skipped'); setPage(1); }}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                statusFilter === 'skipped'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold ring-2 ring-amber-500/20'
                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40 hover:border-amber-300'
              }`}
            >
              <span className="text-[10px] block font-normal">Dilewati (Opt-Out)</span>
              <span className="font-bold text-base">{broadcast.skipped_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recipient Logs Table & WhatsApp Messenger View */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors space-y-4">
        {/* Table Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tampilkan:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Semua Kontak' },
                { id: 'sent', label: 'Sudah Di-Blast' },
                { id: 'pending', label: 'Belum Di-Blast' },
                { id: 'failed', label: 'Gagal' },
                { id: 'skipped', label: 'Dilewati' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    statusFilter === tab.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
              placeholder="Cari nama atau nomor WhatsApp..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Recipients Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Kontak Penerima</th>
                <th className="py-3 px-4">Status Blast</th>
                <th className="py-3 px-4">Pesan yang Disiapkan</th>
                <th className="py-3 px-4">Waktu / Alasan</th>
                <th className="py-3 px-4 text-center">Tampilan WA & Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Tidak ada kontak penerima pada kategori filter ini.
                  </td>
                </tr>
              ) : (
                recipients.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400">{(page - 1) * 20 + idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <span>{r.recipient_name || 'Tanpa Nama'}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        +{r.phone_number}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          r.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : r.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                            : r.status === 'skipped'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            : r.status === 'processing'
                            ? 'bg-brand-500/20 text-brand-700 dark:text-brand-400 animate-pulse'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {r.status === 'sent'
                          ? 'Terkirim'
                          : r.status === 'pending'
                          ? 'Belum Dikirim'
                          : r.status === 'failed'
                          ? 'Gagal'
                          : r.status === 'skipped'
                          ? 'Dilewati'
                          : r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      <span title={r.personalized_message}>{r.personalized_message || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {r.status === 'sent' ? (
                        <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {r.sent_at ? new Date(r.sent_at).toLocaleTimeString('id-ID') : 'Terkirim'}
                        </div>
                      ) : (
                        <div className="text-rose-600 dark:text-rose-400 max-w-xs truncate text-[11px]">
                          {r.error_reason || '-'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Buka Tampilan Obrolan WhatsApp */}
                        <button
                          onClick={() => handleOpenWAChat(r)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center space-x-1 transition border border-emerald-200 dark:border-emerald-800/60"
                          title="Buka obrolan seperti WhatsApp dan kirim pesan manual langsung"
                        >
                          <MessageSquare size={13} />
                          <span>Obrolan WA</span>
                        </button>

                        {/* Kirim Sekarang / Resend */}
                        {r.status !== 'sent' && (
                          <button
                            onClick={() => handleSendNowDirect(r.id)}
                            disabled={actionLoading === `send-${r.id}`}
                            className="px-2 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center space-x-1 transition border border-brand-200 dark:border-brand-800/60 disabled:opacity-50"
                            title="Kirim pesan ke nomor ini sekarang tanpa antrean"
                          >
                            <Send size={12} className={actionLoading === `send-${r.id}` ? 'animate-spin' : ''} />
                            <span>Kirim</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Total {totalRecipientsCount} kontak | Halaman {page} dari {totalPages || 1}
          </span>
          <div className="flex space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 font-semibold"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 font-semibold"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Modal Canggih: Ubah Jangka Waktu Blast Pernomor */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Sliders size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ubah Jangka Waktu Jeda Blast
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Broadcast: <span className="font-semibold text-slate-700 dark:text-slate-300">{broadcast.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDelayModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {delayNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center space-x-2">
                <Check size={16} />
                <span>{delayNotice}</span>
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
                    onClick={() => setCustomDelaySeconds(preset.s)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center ${
                      customDelaySeconds === preset.s
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
                  value={customDelaySeconds}
                  onChange={(e) => setCustomDelaySeconds(Math.max(1, Math.min(600, parseInt(e.target.value || '1', 10))))}
                  className="w-32 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-bold text-sm text-center"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  detik {customDelaySeconds >= 60 ? `(${(customDelaySeconds / 60).toFixed(1).replace('.0', '')} menit)` : ''}
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
                Dengan jeda <strong>{customDelaySeconds} detik/pesan</strong>, sebanyak <strong>{broadcast.pending_count} kontak pending</strong> diperkirakan akan selesai dalam waktu sekitar <strong>~{Math.ceil(((broadcast.pending_count || 0) * customDelaySeconds) / 60)} menit</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDelayModal(false)}
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
                <span>Simpan & Terapkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Panel: Tampilan Seperti WhatsApp & Pengiriman Langsung */}
      {activeChatRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-3xl border border-slate-300 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col h-[580px]">
            {/* WhatsApp Top Header Bar */}
            <div className="bg-[#075e54] dark:bg-[#202c33] text-white p-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {activeChatRecipient.recipient_name?.charAt(0) || <User size={18} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">
                    {activeChatRecipient.recipient_name || 'Kontak WhatsApp'}
                  </h4>
                  <div className="flex items-center space-x-1.5 text-[11px] text-emerald-100 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                    <span className="font-mono">+{activeChatRecipient.phone_number}</span>
                    <span>• online</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => copyToClipboard(activeChatRecipient.phone_number)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition text-xs flex items-center space-x-1"
                  title="Salin Nomor"
                >
                  {copiedPhone ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <a
                  href={`https://wa.me/${activeChatRecipient.phone_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition"
                  title="Buka di WhatsApp Web Resmi"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setActiveChatRecipient(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Body Wallpaper with Bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)]">
              {/* Info Pill */}
              <div className="flex justify-center">
                <span className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full text-[10px] shadow-sm font-semibold border border-slate-200/50 dark:border-slate-800">
                  Status Blast: <strong className="uppercase">{activeChatRecipient.status}</strong>
                </span>
              </div>

              {/* Chat Messages */}
              {chatHistory.map((msg, i) => (
                <div key={i} className="flex justify-end animate-fadeIn">
                  <div className="max-w-[85%] bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3 rounded-2xl rounded-tr-none shadow-sm space-y-1 relative border border-emerald-200/50 dark:border-emerald-800/40">
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                    <div className="flex items-center justify-end space-x-1 text-[10px] text-slate-500 dark:text-emerald-200/70 pt-0.5">
                      <span>{msg.time}</span>
                      {msg.status === 'sent' ? (
                        <CheckCheck size={14} className="text-blue-500" />
                      ) : msg.status === 'failed' ? (
                        <AlertTriangle size={12} className="text-rose-500" />
                      ) : (
                        <Clock size={11} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {directSendSuccess && (
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold text-center border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
                  ✓ {directSendSuccess}
                </div>
              )}
            </div>

            {/* Bottom Chat Input Form */}
            <div className="bg-white dark:bg-[#202c33] p-3 border-t border-slate-200 dark:border-slate-800 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span>Kirim pesan WA langsung ke nomor ini:</span>
                <button
                  type="button"
                  onClick={() => setDirectMsgText(activeChatRecipient.personalized_message || '')}
                  className="text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center space-x-1"
                >
                  <Sparkles size={11} />
                  <span>Isi Ulang Template Blast</span>
                </button>
              </div>

              <form onSubmit={handleSendDirectMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  placeholder="Ketik pesan WhatsApp..."
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={sendingDirect || !directMsgText.trim()}
                  className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition disabled:opacity-40"
                  title="Kirim Pesan WhatsApp Sekarang"
                >
                  {sendingDirect ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
