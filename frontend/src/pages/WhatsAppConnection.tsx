import React, { useState } from 'react';
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
  Smartphone
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../services/api.js';

export const WhatsAppConnection: React.FC = () => {
  const { waStatus } = useSocket();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleConnect = async () => {
    setLoadingAction('connect');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/connect');
      setMessage({ text: res.data?.message || 'Memulai koneksi...', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal memulai koneksi', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    setLoadingAction('disconnect');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/disconnect');
      setMessage({ text: res.data?.message || 'Koneksi diputuskan.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal memutuskan', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Apakah Anda yakin ingin mengeluarkan sesi WhatsApp ini? Anda harus scan ulang QR code.')) return;
    setLoadingAction('logout');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/logout');
      setMessage({ text: res.data?.message || 'Sesi berhasil dikeluarkan.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal logout', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestart = async () => {
    setLoadingAction('restart');
    setMessage(null);
    try {
      const res = await api.post('/whatsapp/restart');
      setMessage({ text: res.data?.message || 'Koneksi direstart...', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal restart', type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                waStatus.status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : waStatus.status === 'connecting'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              <Radio size={28} className={waStatus.status === 'connected' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Koneksi Baileys WhatsApp</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    waStatus.status === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : waStatus.status === 'connecting'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {waStatus.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Sesi autentikasi tersimpan secara persisten dan aman pada server
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {waStatus.status !== 'connected' && (
              <button
                onClick={handleConnect}
                disabled={loadingAction === 'connect'}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition disabled:opacity-50"
              >
                <Power size={15} />
                <span>{loadingAction === 'connect' ? 'Menghubungkan...' : 'Hubungkan'}</span>
              </button>
            )}

            {waStatus.status === 'connected' && (
              <>
                <button
                  onClick={handleRestart}
                  disabled={loadingAction === 'restart'}
                  title="Restart Sesi"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <RefreshCw size={16} className={loadingAction === 'restart' ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loadingAction === 'disconnect'}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                >
                  <Power size={15} />
                  <span>Putuskan</span>
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loadingAction === 'logout'}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/50 transition"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: QR View & Account Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: QR Code Box */}
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors min-h-[360px]">
          {waStatus.status === 'connected' ? (
            <div className="space-y-4 py-8">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle size={42} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">WhatsApp Sudah Terhubung!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Bot siap menerima perintah WhatsApp Admin dan mengeksekusi antrean broadcast secara real-time.
                </p>
              </div>
            </div>
          ) : waStatus.qrCode ? (
            <div className="space-y-4">
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 inline-block">
                <img
                  src={waStatus.qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 object-contain"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center space-x-1.5">
                  <Smartphone size={16} className="text-brand-600" />
                  <span>Pindai QR dengan WhatsApp Anda</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Buka WhatsApp di ponsel &gt; Ketuk Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <QrCode size={32} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">QR Code Belum Tersedia</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Klik tombol <strong>Hubungkan</strong> di atas untuk memicu inisialisasi sesi Baileys dan generate QR code.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition"
              >
                Mulai Koneksi Sekarang
              </button>
            </div>
          )}
        </div>

        {/* Right: Account Information & Safety Tips */}
        <div className="space-y-6">
          {/* Account Profile Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Informasi Akun Terdaftar</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Nama Akun WhatsApp:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{waStatus.name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Nomor WhatsApp:</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                  {waStatus.phone ? `+${waStatus.phone}` : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Library Engine:</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">@whiskeysockets/baileys Multi-File Auth</span>
              </div>
              <div className="flex justify-between py-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Pengendali Admin DM:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Aktif & Siap Menerima Chat</span>
              </div>
            </div>
          </div>

          {/* Compliance & Responsible Sending Notice */}
          <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs space-y-1.5">
                <h4 className="font-bold">Pedoman Pengiriman Bertanggung Jawab</h4>
                <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  Untuk menjaga reputasi nomor WhatsApp Anda:
                </p>
                <ul className="list-disc list-inside space-y-1 text-amber-800/90 dark:text-amber-300/80">
                  <li>Hanya kirim pesan ke kontak yang telah memberikan persetujuan (opt-in).</li>
                  <li>Gunakan jeda pengiriman minimal 3-6 detik antar pesan.</li>
                  <li>Sertakan instruksi STOP/Opt-Out pada template pesan Anda.</li>
                  <li>Jangan mengirim spam atau konten yang melanggar ketentuan WhatsApp.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
