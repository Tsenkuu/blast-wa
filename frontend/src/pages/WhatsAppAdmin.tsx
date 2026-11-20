import React, { useState, useEffect } from 'react';
import {
  Bot,
  UserPlus,
  Trash2,
  Bell,
  Check,
  Shield,
  Phone,
  HelpCircle,
  Smartphone,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.js';
import { WhatsAppAdmin as WhatsAppAdminType } from '../types/index.js';

export const WhatsAppAdmin: React.FC = () => {
  const [admins, setAdmins] = useState<WhatsAppAdminType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [canBroadcast, setCanBroadcast] = useState(true);
  const [canManageExcel, setCanManageExcel] = useState(true);
  const [notifyOnEvents, setNotifyOnEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admins');
      if (res.data?.success) setAdmins(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async () => {
    if (!phoneNumber.trim() || !name.trim()) {
      setMessage({ text: 'Nomor telepon dan nama admin wajib diisi.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await api.post('/admins', {
        phoneNumber,
        name,
        canBroadcast,
        canManageExcel,
        notifyOnEvents
      });
      if (res.data?.success) {
        setModalOpen(false);
        setPhoneNumber('');
        setName('');
        fetchAdmins();
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal menambahkan admin', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: WhatsAppAdminType) => {
    try {
      await api.put(`/admins/${admin.id}`, {
        isActive: admin.is_active === 1 ? 0 : 1
      });
      fetchAdmins();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    if (!confirm('Hapus hak akses WhatsApp admin ini?')) return;
    try {
      await api.delete(`/admins/${id}`);
      fetchAdmins();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pengendali WhatsApp Admin</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola nomor WhatsApp resmi yang diizinkan mengendalikan bot melalui chat pribadi (DM)
          </p>
        </div>
        <button
          onClick={() => {
            setPhoneNumber('');
            setName('');
            setModalOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
        >
          <UserPlus size={16} />
          <span>Tambah Admin Baru</span>
        </button>
      </div>

      {/* Guide Card: How it Works */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-navy-900 to-slate-900 text-white shadow-md border border-slate-800">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-brand-600 text-white mt-0.5">
            <Smartphone size={22} />
          </div>
          <div className="space-y-1.5 text-xs">
            <h3 className="font-bold text-sm text-brand-300">Cara Kerja Kontroler WhatsApp Admin (Chat Pribadi)</h3>
            <p className="text-slate-300 leading-relaxed">
              Nomor yang terdaftar di bawah dapat langsung mengendalikan sistem ini melalui chat 1-on-1 dengan nomor bot WhatsApp:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-brand-200">
              <div className="bg-slate-800/80 p-2 rounded-lg">
                <span className="text-amber-400 font-bold">!status</span> - Pantau bot, koneksi WA, & RAM
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg">
                <span className="text-amber-400 font-bold">!excel simpan "Nama"</span> - Kirim file Excel langsung via WA
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg">
                <span className="text-amber-400 font-bold">!blast buat "Dataset"</span> - Buat broadcast interaktif
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg">
                <span className="text-amber-400 font-bold">!blast jeda / lanjut / batal &lt;ID&gt;</span> - Kontrol antrean
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-1">
              * Keamanan: Perintah dari grup atau nomor tidak dikenal akan ditolak otomatis.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Daftar Admin WhatsApp Terdaftar</h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Memuat admin...</div>
        ) : admins.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Belum ada nomor admin yang terdaftar. Klik <strong>Tambah Admin Baru</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Nama Admin</th>
                  <th className="py-3 px-4">Nomor WhatsApp</th>
                  <th className="py-3 px-4 text-center">Hak Broadcast</th>
                  <th className="py-3 px-4 text-center">Hak Excel</th>
                  <th className="py-3 px-4 text-center">Notifikasi Alert</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {admins.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                        {a.name.charAt(0)}
                      </div>
                      <span>{a.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">+{a.phone_number}</td>
                    <td className="py-3 px-4 text-center">
                      {a.can_broadcast === 1 ? (
                        <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {a.can_manage_excel === 1 ? (
                        <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {a.notify_on_events === 1 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(a)}
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition ${
                          a.is_active === 1
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {a.is_active === 1 ? 'Aktif' : 'Diblokir'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteAdmin(a.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Hapus Hak Admin"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Nomor WhatsApp Admin"
        maxWidth="md"
      >
        <div className="space-y-4">
          {message && (
            <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-semibold">
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Nomor WhatsApp Admin (08xx / 628xx)
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Nama Admin
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Admin Operasional"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canBroadcast}
                onChange={(e) => setCanBroadcast(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Izinkan Membuat & Mengontrol Broadcast via WA
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canManageExcel}
                onChange={(e) => setCanManageExcel(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Izinkan Upload File Excel via WhatsApp
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnEvents}
                onChange={(e) => setNotifyOnEvents(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Kirim Notifikasi Laporan Broadcast & Perubahan Sistem
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Batal
            </button>
            <button
              onClick={handleAddAdmin}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Admin'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
