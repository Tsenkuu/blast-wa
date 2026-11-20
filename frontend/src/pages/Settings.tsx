import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  AlertTriangle,
  Save,
  CheckCircle,
  Clock,
  History,
  Lock,
  Power
} from 'lucide-react';
import { api } from '../services/api.js';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    min_delay_ms: '3000',
    max_delay_ms: '6000',
    max_retries: '2',
    circuit_breaker_fails: '5',
    daily_send_limit: '1000',
    consent_required: '1',
    emergency_stop: '0'
  });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Settings Save Message
  const [saveMsg, setSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchSettingsAndAudit = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/settings'),
        api.get('/logs/audit?limit=15')
      ]);

      if (sRes.data?.success) {
        setSettings((prev) => ({ ...prev, ...sRes.data.data.mapped }));
      }
      if (aRes.data?.success) {
        setAuditLogs(aRes.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettingsAndAudit();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await api.put('/settings', settings);
      setSaveMsg({ text: res.data?.message || 'Pengaturan berhasil disimpan!', type: 'success' });
    } catch (err: any) {
      setSaveMsg({ text: err.response?.data?.message || 'Gagal menyimpan pengaturan', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmergencyStop = async () => {
    const nextVal = settings.emergency_stop === '1' ? '0' : '1';
    const isActivating = nextVal === '1';

    if (isActivating && !confirm('PERINGATAN: Tombol Darurat (Emergency Stop) akan langsung menjeda seluruh broadcast yang sedang berjalan! Apakah Anda yakin?')) {
      return;
    }

    try {
      await api.post('/broadcasts/emergency-stop', { stop: isActivating });
      setSettings((prev) => ({ ...prev, emergency_stop: nextVal }));
      setSaveMsg({
        text: isActivating ? 'EMERGENCY STOP DIAKTIFKAN!' : 'Status darurat dicabut.',
        type: isActivating ? 'error' : 'success'
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah status darurat');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ text: 'Harap lengkapi semua kolom password.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Konfirmasi password baru tidak cocok.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Password baru minimal 6 karakter.', type: 'error' });
      return;
    }

    setPasswordMsg(null);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordMsg({ text: res.data?.message || 'Password berhasil diperbarui!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ text: err.response?.data?.message || 'Gagal mengubah password', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Title */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pengaturan & Keamanan Sistem</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          Konfigurasi anti-ban rate limiting, batas kuota broadcast, tombol darurat, dan audit log pengguna
        </p>
      </div>

      {/* Emergency Stop Panel */}
      <div className={`p-6 rounded-2xl border transition-all ${
        settings.emergency_stop === '1'
          ? 'bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300'
          : 'bg-white dark:bg-navy-900 border-slate-200/80 dark:border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`p-3 rounded-2xl text-white ${settings.emergency_stop === '1' ? 'bg-rose-600 animate-pulse' : 'bg-slate-700'}`}>
              <Power size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Tombol Darurat (Emergency Stop)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Menghentikan / menjeda seluruh antrean broadcast secara seketika jika terjadi situasi darurat atau risiko pemblokiran nomor.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleEmergencyStop}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition self-start sm:self-auto ${
              settings.emergency_stop === '1'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
            }`}
          >
            {settings.emergency_stop === '1' ? 'Cabut Status Darurat' : 'AKTIFKAN EMERGENCY STOP'}
          </button>
        </div>
      </div>

      {/* Anti-Ban & Rate Limit Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="text-brand-600" size={20} />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Pengaturan Jeda & Proteksi Anti-Ban
          </h3>
        </div>

        {saveMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold ${
              saveMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {saveMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Jeda Minimal Antar Pesan (Milidetik)
            </label>
            <input
              type="number"
              value={settings.min_delay_ms || ''}
              onChange={(e) => setSettings({ ...settings, min_delay_ms: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Contoh: 3000 ms = 3 detik</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Jeda Maksimal Antar Pesan (Milidetik)
            </label>
            <input
              type="number"
              value={settings.max_delay_ms || ''}
              onChange={(e) => setSettings({ ...settings, max_delay_ms: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Jeda akan diacak antara min dan max</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Maksimum Percobaan Ulang (Max Retries)
            </label>
            <input
              type="number"
              value={settings.max_retries || ''}
              onChange={(e) => setSettings({ ...settings, max_retries: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Batas retry untuk pesan gagal sementara</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Ambang Batas Circuit Breaker
            </label>
            <input
              type="number"
              value={settings.circuit_breaker_fails || ''}
              onChange={(e) => setSettings({ ...settings, circuit_breaker_fails: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Jumlah kegagalan beruntun sebelum jeda otomatis</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Batas Kirim Harian (Daily Send Limit)
            </label>
            <input
              type="number"
              value={settings.daily_send_limit || ''}
              onChange={(e) => setSettings({ ...settings, daily_send_limit: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Validasi Persetujuan (Consent Required)
            </label>
            <select
              value={settings.consent_required || '1'}
              onChange={(e) => setSettings({ ...settings, consent_required: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white font-medium"
            >
              <option value="1">Wajib (Hanya kirim ke kontak berstatus consent granted)</option>
              <option value="0">Nonaktifkan Pengecekan Persetujuan</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            <Save size={15} />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Key className="text-amber-500" size={20} />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Ganti Password Akun</h3>
        </div>

        {passwordMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Password Saat Ini
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Password Baru (Min 6 Karakter)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md transition"
            >
              Perbarui Password
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
          <History size={16} className="text-slate-400" />
          <span>Audit Log Aktivitas Terakhir</span>
        </h3>

        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Aksi</th>
                <th className="py-2.5 px-3">Resource</th>
                <th className="py-2.5 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">Belum ada catatan audit log.</td>
                </tr>
              ) : (
                auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 text-slate-400">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                    <td className="py-2 px-3 font-semibold">{a.username || 'System'}</td>
                    <td className="py-2 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">{a.action}</td>
                    <td className="py-2 px-3 text-slate-500">{a.resource}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{a.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
