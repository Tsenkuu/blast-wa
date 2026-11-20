import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Edit2, Sparkles, Image, CheckCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.js';
import { Template, MediaFile } from '../types/index.js';

export const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [defaultMediaId, setDefaultMediaId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const [tRes, mRes] = await Promise.all([
        api.get('/templates'),
        api.get('/media')
      ]);
      if (tRes.data?.success) setTemplates(tRes.data.data);
      if (mRes.data?.success) setMediaList(mRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setContent('');
    setDefaultMediaId('');
    setModalOpen(true);
  };

  const openEditModal = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.content);
    setDefaultMediaId(t.default_media_id || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      setMessage({ text: 'Nama dan isi template wajib diisi.', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      name,
      content,
      defaultMediaId: defaultMediaId ? Number(defaultMediaId) : null
    };

    try {
      if (editingId) {
        await api.put(`/templates/${editingId}`, payload);
      } else {
        await api.post('/templates', payload);
      }
      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal menyimpan template', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus template pesan ini?')) return;
    try {
      await api.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const insertTag = (tag: string) => {
    setContent((prev) => `${prev}{{${tag}}}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Template Pesan WhatsApp</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Simpan format pesan berulang dengan variabel dinamis {`{{nama}}`}, {`{{B}}`}, {`{{C}}`}, dan emoji
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
        >
          <Plus size={16} />
          <span>Buat Template Baru</span>
        </button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Memuat template...</div>
      ) : templates.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          Belum ada template yang disimpan. Klik <strong>Buat Template Baru</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FileText size={18} className="text-brand-600 dark:text-brand-400" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                      {t.name}
                    </h3>
                  </div>
                  {t.has_media === 1 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold flex items-center space-x-1">
                      <Image size={11} />
                      <span>Bergambar</span>
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto font-sans">
                  {t.content}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  onClick={() => openEditModal(t)}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  title="Edit Template"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                  title="Hapus Template"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Template Pesan' : 'Buat Template Pesan Baru'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {message && (
            <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-semibold">
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Nama Template
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Undangan Kegiatan Relawan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Isi Template Pesan
              </label>
              <span className="text-[10px] text-slate-400">Klik variabel di bawah untuk menyisipkan</span>
            </div>

            {/* Variable insertion buttons */}
            <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              {['nama', 'nomor', 'keterangan', 'A', 'B', 'C'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-400 text-[11px] font-mono font-bold hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"
                >
                  +{`{{${tag}}}`}
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Halo {{nama}}, kami mengundang Anda untuk mengikuti kegiatan di wilayah {{keterangan}}...&#10;&#10;Ketik STOP jika tidak ingin menerima pesan ini."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Default Gambar (Opsional)
            </label>
            <select
              value={defaultMediaId}
              onChange={(e) => setDefaultMediaId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs"
            >
              <option value="">-- Tanpa Gambar Default --</option>
              {mediaList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.original_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
