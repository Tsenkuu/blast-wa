import React, { useState, useEffect } from 'react';
import { Image, Upload, Trash2, Eye, CheckCircle, AlertTriangle, FileImage } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.js';
import { MediaFile } from '../types/index.js';

export const MediaManager: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media');
      if (res.data?.success) setMediaList(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setMessage({ text: 'Gambar berhasil diupload!', type: 'success' });
        fetchMedia();
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal mengupload gambar', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus file gambar ini dari server?')) return;
    try {
      await api.delete(`/media/${id}`);
      fetchMedia();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Media Manager</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola arsip gambar broadcast (JPG, JPEG, PNG, WebP) untuk lampiran pesan WhatsApp
          </p>
        </div>

        <div>
          <input
            type="file"
            id="media-file-upload"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <label
            htmlFor="media-file-upload"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 cursor-pointer transition"
          >
            <Upload size={16} />
            <span>{uploading ? 'Mengupload...' : 'Upload Gambar Baru'}</span>
          </label>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{message.text}</span>
        </div>
      )}

      {/* Media Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Memuat galeri media...</div>
      ) : mediaList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          Belum ada file media yang diupload. Klik <strong>Upload Gambar Baru</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mediaList.map((m) => (
            <div
              key={m.id}
              className="group p-2.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition"
            >
              <div
                onClick={() => setPreviewMedia(m)}
                className="aspect-square w-full rounded-xl bg-slate-100 dark:bg-navy-950 overflow-hidden cursor-pointer relative"
              >
                <img
                  src={`/uploads/${m.filename}`}
                  alt={m.original_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye size={20} className="text-white" />
                </div>
              </div>

              <div className="pt-2 px-1">
                <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title={m.original_name}>
                  {m.original_name}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{(m.file_size / 1024).toFixed(0)} KB</span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Hapus"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Fullscreen Preview Modal */}
      {previewMedia && (
        <Modal
          isOpen={!!previewMedia}
          onClose={() => setPreviewMedia(null)}
          title={previewMedia.original_name}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-center">
            <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-navy-950 max-h-[70vh] flex items-center justify-center">
              <img
                src={`/uploads/${previewMedia.filename}`}
                alt={previewMedia.original_name}
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Ukuran: {(previewMedia.file_size / 1024).toFixed(1)} KB ({previewMedia.mime_type})</span>
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
