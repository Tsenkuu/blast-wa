import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Radio,
  CheckCircle,
  AlertCircle,
  LogOut,
  Power,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Trash2,
  HelpCircle,
  Info,
  Server,
  KeyRound,
  Check
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../services/api.js';

export const WhatsAppConnection: React.FC = () => {
  const { waStatus } = useSocket();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [localStatus, setLocalStatus] = useState<any>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Sync initial status from backend on mount
  const fetchStatus = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      if (res.data?.success) {
        setLocalStatus(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch WA status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Merge socket waStatus with local fetched status
  const currentStatus = waStatus.status !== 'disconnected' || !localStatus ? waStatus : localStatus;
  const statusState = waStatus.qrCode ? 'connecting' : (currentStatus.status || 'disconnected');
  const qrImage = waStatus.qrCode || currentStatus.qrCode;

  const handleConnect = async () => {
    setLoadingAction('connect');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/connect');
      setMessage({ text: res.data?.message || 'Memulai koneksi Baileys...', type: 'success' });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal memulai koneksi', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReconnect = async () => {
    setLoadingAction('reconnect');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/reconnect');
      setMessage({ text: res.data?.message || 'Mengkoneksi ulang socket Baileys...', type: 'success' });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal mengkoneksi ulang', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    setLoadingAction('disconnect');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/disconnect');
      setMessage({ text: res.data?.message || 'Koneksi WhatsApp diputuskan.', type: 'info' });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal memutuskan', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetSession = async () => {
    setShowResetModal(false);
    setLoadingAction('reset');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/reset-session');
      setMessage({
        text: res.data?.message || 'Sesi WhatsApp berhasil direset total. Berkas kredensial dibersihkan.',
        type: 'success'
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal mereset sesi', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    setLoadingAction('logout');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/logout');
      setMessage({ text: res.data?.message || 'Sesi berhasil dikeluarkan (logout).', type: 'success' });
      await fetchStatus();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal logout', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Banner & Control Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center space-x-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                statusState === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : statusState === 'connecting'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              <Radio size={28} className={statusState === 'connected' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Koneksi Baileys WhatsApp</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    statusState === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : statusState === 'connecting'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 animate-pulse'
                      : statusState === 'logged_out'
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                      : 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {statusState}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Multi-File Auth Engine • Auto Reconnect • Resilient Session Manager
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hubungkan */}
            {statusState !== 'connected' && (
              <button
                onClick={handleConnect}
                disabled={loadingAction !== null}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition disabled:opacity-50"
              >
                <Power size={15} />
                <span>{loadingAction === 'connect' ? 'Menghubungkan...' : 'Hubungkan'}</span>
              </button>
            )}

            {/* Koneksi Ulang (Reconnect) */}
            <button
              onClick={handleReconnect}
              disabled={loadingAction !== null}
              title="Putuskan socket lama dan buat koneksi baru tanpa menghapus kredensial tersimpan"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-900/50 transition disabled:opacity-50"
            >
              <RefreshCw size={15} className={loadingAction === 'reconnect' ? 'animate-spin' : ''} />
              <span>{loadingAction === 'reconnect' ? 'Mengkoneksi...' : 'Koneksi Ulang'}</span>
            </button>

            {/* Putuskan (Disconnect) */}
            {statusState === 'connected' && (
              <button
                onClick={handleDisconnect}
                disabled={loadingAction !== null}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition disabled:opacity-50"
              >
                <Power size={15} />
                <span>Putuskan</span>
              </button>
            )}

            {/* Reset Sesi (Clear Auth Files) */}
            <button
              onClick={() => setShowResetModal(true)}
              disabled={loadingAction !== null}
              title="Bersihkan total file sesi di server dan siapkan QR baru jika koneksi bermasalah atau ingin ganti nomor"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold text-xs border border-amber-200 dark:border-amber-900/50 transition disabled:opacity-50"
            >
              <Trash2 size={15} />
              <span>Reset Sesi</span>
            </button>

            {/* Logout */}
            {statusState === 'connected' && (
              <button
                onClick={() => setShowLogoutModal(true)}
                disabled={loadingAction !== null}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/50 transition disabled:opacity-50"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : message.type === 'info'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle size={16} className="flex-shrink-0" />
            ) : message.type === 'info' ? (
              <Info size={16} className="flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: QR View & Account Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): QR Code Box & Instructions */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors min-h-[420px]">
          {statusState === 'connected' ? (
            <div className="space-y-5 py-8 max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                <CheckCircle size={46} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp Bot Aktif & Terhubung!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Baileys socket berhasil diotentikasi. Bot siap memproses antrean broadcast Excel dan menerima perintah chat admin.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={loadingAction !== null}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 transition"
                >
                  <RefreshCw size={14} className={loadingAction === 'reconnect' ? 'animate-spin' : ''} />
                  <span>Cek / Perbarui Koneksi</span>
                </button>
              </div>
            </div>
          ) : qrImage ? (
            <div className="space-y-5 py-4 max-w-sm mx-auto">
              <div className="p-3.5 bg-white rounded-2xl shadow-lg border border-slate-200/80 inline-block relative group">
                <img
                  src={qrImage}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 object-contain rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center space-x-2">
                  <Smartphone size={18} className="text-brand-600" />
                  <span>Pindai QR Code Menggunakan WhatsApp</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Buka WhatsApp di ponsel &gt; Ketuk Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat.
                </p>
              </div>

              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={loadingAction !== null}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs flex items-center space-x-1 transition"
                >
                  <RefreshCw size={13} className={loadingAction === 'reconnect' ? 'animate-spin' : ''} />
                  <span>Muat Ulang QR</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 py-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <QrCode size={34} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {statusState === 'connecting' ? 'Menyiapkan QR Code...' : 'Sesi Belum Terhubung'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {statusState === 'connecting'
                    ? 'Sedang menghubungkan ke server WhatsApp dan mengunduh pairing QR code terbaru...'
                    : 'Klik tombol di bawah ini untuk memulai koneksi dan menampilkan QR code autentikasi.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={handleConnect}
                  disabled={loadingAction !== null}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Power size={14} />
                  <span>Mulai Koneksi</span>
                </button>
                <button
                  onClick={handleReconnect}
                  disabled={loadingAction !== null}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <RefreshCw size={14} className={loadingAction === 'reconnect' ? 'animate-spin' : ''} />
                  <span>Koneksi Ulang</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Account Profile & Diagnostics */}
        <div className="lg:col-span-5 space-y-6">
          {/* Account Profile Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Server size={16} className="text-brand-600" />
              <span>Informasi Sesi WhatsApp</span>
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Nama Akun:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentStatus.name || waStatus.name || '-'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Nomor WhatsApp:</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                  {currentStatus.phone || waStatus.phone ? `+${currentStatus.phone || waStatus.phone}` : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Library Engine:</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">@whiskeysockets/baileys</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Penyimpanan Kredensial:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Multi-File Auth (Persistent)</span>
              </div>
              <div className="flex justify-between py-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Fitur Admin DM:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <Check size={14} />
                  <span>Aktif & Terintegrasi</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Troubleshooting Guide */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-navy-950/50 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-2 flex items-center space-x-1.5">
              <HelpCircle size={15} className="text-brand-600" />
              <span>Panduan Solusi Masalah Koneksi</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-slate-800/80">
                <strong className="text-slate-800 dark:text-slate-200 block text-[11px] mb-0.5">
                  1. Tombol "Koneksi Ulang":
                </strong>
                Gunakan jika WhatsApp sempat terputus (jaringan down/laptop sleep) atau ingin memperbarui QR code tanpa menghapus akun tersimpan.
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-slate-800/80">
                <strong className="text-amber-700 dark:text-amber-400 block text-[11px] mb-0.5">
                  2. Tombol "Reset Sesi":
                </strong>
                Gunakan jika sesi stuck (gagal pairing/error 401/515 berulang) atau Anda ingin mengganti nomor WhatsApp bot ke nomor lain.
              </div>
            </div>
          </div>

          {/* Compliance & Safety Tips */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200">
            <div className="flex items-start space-x-2.5">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-xs space-y-1">
                <h4 className="font-bold">Tips Aman Anti Banned</h4>
                <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed text-[11px]">
                  Gunakan jeda minimal 5–10 detik per pesan, kirim hanya ke kontak yang telah memberikan izin (opt-in), dan jangan kirim pesan spam massal sekaligus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Reset Sesi */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Reset Sesi WhatsApp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Tindakan ini akan <strong>menutup koneksi aktif</strong> dan <strong>menghapus seluruh berkas kredensial login</strong> yang tersimpan di server. Anda harus memindai ulang QR code baru untuk menghubungkan WhatsApp kembali.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleResetSession}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition"
              >
                Ya, Reset Sesi Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Logout */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <LogOut size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Logout Akun WhatsApp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin mengeluarkan sesi akun WhatsApp ini dari server? Perangkat tertaut pada ponsel akan diputus.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition"
              >
                Ya, Logout Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
