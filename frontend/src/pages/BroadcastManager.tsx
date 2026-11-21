import React, { useState, useEffect } from 'react';
import {
  Send,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Clock,
  Eye,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api.js';
import { Dataset, Template, MediaFile } from '../types/index.js';

interface BroadcastManagerProps {
  onBroadcastCreated: (broadcastId: number) => void;
}

export const BroadcastManager: React.FC<BroadcastManagerProps> = ({ onBroadcastCreated }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);

  // Form State
  const [broadcastName, setBroadcastName] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [messageText, setMessageText] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState<number | ''>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(4);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  // Sample Recipient for Live Preview
  const [sampleRecipient, setSampleRecipient] = useState<any>(null);
  const [previewResolvedText, setPreviewResolvedText] = useState('');
  const [missingVariables, setMissingVariables] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dsRes, tplRes, medRes, setRes] = await Promise.all([
          api.get('/excel/datasets'),
          api.get('/templates'),
          api.get('/media'),
          api.get('/settings')
        ]);

        if (dsRes.data?.success) setDatasets(dsRes.data.data);
        if (tplRes.data?.success) setTemplates(tplRes.data.data);
        if (medRes.data?.success) setMediaList(medRes.data.data);

        // Pre-fill delay from global settings
        if (setRes.data?.success && setRes.data.data?.mapped?.min_delay_ms) {
          const raw = parseInt(setRes.data.data.mapped.min_delay_ms, 10);
          if (raw > 0) {
            const sec = raw <= 300 ? raw : Math.round(raw / 1000);
            setDelaySeconds(Math.max(1, Math.min(600, sec)));
          }
        }

        // Pre-select first dataset if available
        if (dsRes.data?.data?.length > 0) {
          setSelectedDatasetId(dsRes.data.data[0].id);
        }
      } catch (e) {
        console.error('Failed to load broadcast initial data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch sample contact when dataset changes
  useEffect(() => {
    if (!selectedDatasetId) {
      setSampleRecipient(null);
      return;
    }
    api.get(`/excel/datasets/${selectedDatasetId}?limit=1`)
      .then((res) => {
        if (res.data?.data?.contacts?.length > 0) {
          setSampleRecipient(res.data.data.contacts[0]);
        } else {
          setSampleRecipient(null);
        }
      })
      .catch((e) => console.error(e));
  }, [selectedDatasetId]);

  // Handle template selection
  const handleTemplateSelect = (tplId: number | '') => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setMessageText(tpl.content);
      if (tpl.default_media_id) {
        setSelectedMediaId(tpl.default_media_id);
      }
    }
  };

  // Re-calculate Live Preview whenever text or sample recipient changes
  useEffect(() => {
    if (!messageText) {
      setPreviewResolvedText('');
      setMissingVariables([]);
      return;
    }

    let extraData: Record<string, string> = {};
    if (sampleRecipient) {
      try {
        extraData = JSON.parse(sampleRecipient.extra_data_json || '{}');
      } catch (e) {
        extraData = {
          A: sampleRecipient.phone_number,
          B: sampleRecipient.name,
          C: sampleRecipient.notes,
          nomor: sampleRecipient.phone_number,
          nama: sampleRecipient.name,
          keterangan: sampleRecipient.notes
        };
      }
    } else {
      extraData = {
        A: '6281234567890',
        B: 'Ahmad Santoso',
        C: 'Tulungagung',
        nomor: '6281234567890',
        nama: 'Ahmad Santoso',
        keterangan: 'Tulungagung'
      };
    }

    // Build lowercase lookup
    const lookup: Record<string, string> = {};
    for (const [k, v] of Object.entries(extraData)) {
      lookup[k.toLowerCase()] = String(v);
    }

    const missing: string[] = [];
    const resolved = messageText.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const cleanVar = varName.trim();
      const lower = cleanVar.toLowerCase();
      if (lower in lookup) {
        return lookup[lower];
      } else {
        missing.push(cleanVar);
        return match;
      }
    });

    setPreviewResolvedText(resolved);
    setMissingVariables(Array.from(new Set(missing)));
  }, [messageText, sampleRecipient]);

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setImageFile(f);
      setImagePreviewUrl(URL.createObjectURL(f));
      setSelectedMediaId(''); // clear media library select
    }
  };

  // Insert Variable helper
  const insertVariable = (varName: string) => {
    setMessageText((prev) => `${prev}{{${varName}}}`);
  };

  const handleStartBroadcast = async () => {
    if (!broadcastName.trim()) {
      setError('Harap beri nama broadcast ini.');
      return;
    }
    if (!selectedDatasetId) {
      setError('Harap pilih dataset Excel target.');
      return;
    }
    if (!messageText.trim()) {
      setError('Isi template pesan tidak boleh kosong.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      let finalMediaId: number | null = selectedMediaId ? Number(selectedMediaId) : null;

      // If user uploaded a new local file, upload to Media Manager first
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const medRes = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (medRes.data?.success) {
          finalMediaId = medRes.data.data.id;
        }
      }

      // Create and Queue Broadcast
      const payload = {
        name: broadcastName,
        datasetId: selectedDatasetId,
        templateId: selectedTemplateId || null,
        customMessage: messageText,
        mediaId: finalMediaId,
        delaySeconds: Number(delaySeconds),
        scheduledAt: isScheduled && scheduledDate ? scheduledDate : null
      };

      const res = await api.post('/broadcasts', payload);
      if (res.data?.success) {
        onBroadcastCreated(res.data.data.broadcastId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal membuat broadcast.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Broadcast Manager</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          Kirim pesan massal terpersonalisasi ke ratusan atau ribuan nomor kontak dengan antrean persisten di background
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2-Column Layout: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
            {/* 1. Broadcast Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Nama Broadcast / Kampanye <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={broadcastName}
                onChange={(e) => setBroadcastName(e.target.value)}
                placeholder="Contoh: Undangan Kegiatan Relawan November"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* 2. Select Dataset */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Pilih Dataset Excel Target <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Pilih Dataset --</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.valid_rows} nomor valid)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Load Template Preset (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Gunakan Template Tersimpan (Opsional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Tulis Pesan Baru / Tanpa Template --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Message Content & Quick Dynamic Variables */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Isi Pesan WhatsApp <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Mendukung emoji, Unicode & baris baru</span>
              </div>

              {/* Quick Variable Badges */}
              <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 self-center mr-1">
                  Variabel:
                </span>
                {['nama', 'nomor', 'keterangan', 'A', 'B', 'C'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-navy-900 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold transition"
                  >
                    +{`{{${v}}}`}
                  </button>
                ))}
              </div>

              <textarea
                rows={7}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Halo {{nama}}, kami mengundang Anda untuk mengikuti acara di {{keterangan}}...&#10;&#10;Ketik STOP jika ingin berhenti menerima pesan ini."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed font-sans"
              />
            </div>

            {/* 5. Media Image Attachment */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                Lampiran Gambar (Opsional)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload from Computer */}
                <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="broadcast-image-input"
                  />
                  <label
                    htmlFor="broadcast-image-input"
                    className="cursor-pointer flex flex-col items-center space-y-1 text-slate-500 hover:text-brand-600 transition"
                  >
                    <ImageIcon size={20} />
                    <span className="text-[11px] font-semibold">Upload Gambar Baru</span>
                    <span className="text-[10px] text-slate-400">JPG, PNG, WebP (Maks 15MB)</span>
                  </label>
                </div>

                {/* Select from Media Library */}
                <div>
                  <select
                    value={selectedMediaId}
                    onChange={(e) => {
                      setSelectedMediaId(e.target.value ? Number(e.target.value) : '');
                      setImageFile(null);
                      const med = mediaList.find((m) => m.id === Number(e.target.value));
                      setImagePreviewUrl(med ? `/uploads/${med.filename}` : null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs"
                  >
                    <option value="">-- Pilih dari Media Library --</option>
                    {mediaList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.original_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {imagePreviewUrl && (
                <div className="mt-3 flex items-center space-x-3 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                  <div className="text-[11px] truncate flex-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {imageFile?.name || 'Gambar Terpilih'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreviewUrl(null);
                      setSelectedMediaId('');
                    }}
                    className="text-xs text-rose-500 font-bold hover:underline px-2"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {/* 6. Delay Configuration (Jeda Antar Pesan) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Jeda Antar Pesan (Detik) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Proteksi Anti-Ban WhatsApp</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(1, Math.min(600, parseInt(e.target.value || '1', 10))))}
                    className="w-24 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 text-center"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    detik {delaySeconds >= 60 ? `(${(delaySeconds / 60).toFixed(1).replace('.0', '')} menit)` : ''}
                  </span>
                </div>
                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { s: 5, label: '5s' },
                    { s: 10, label: '10s' },
                    { s: 15, label: '15s' },
                    { s: 30, label: '30s' },
                    { s: 60, label: '1 Menit (60s)' },
                    { s: 120, label: '2 Menit (120s)' }
                  ].map((p) => (
                    <button
                      key={p.s}
                      type="button"
                      onClick={() => setDelaySeconds(p.s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        delaySeconds === p.s
                          ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Memberikan jeda waktu {delaySeconds} detik ({delaySeconds >= 60 ? `${(delaySeconds / 60).toFixed(1).replace('.0', '')} menit` : `${delaySeconds} detik`}) setelah setiap nomor selesai dikirim agar aktivitas tampak alami dan aman dari blokir WhatsApp.
              </p>
            </div>

            {/* 7. Scheduling Option */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Jadwalkan Pengiriman (Schedule)
                </span>
              </label>

              {isScheduled && (
                <div className="mt-2.5">
                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleStartBroadcast}
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                <Send size={16} />
                <span>{submitting ? 'Memproses Broadcast...' : 'Mulai Broadcast Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat Simulation Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors sticky top-28">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                <Eye size={16} className="text-brand-600" />
                <span>Pratinjau Pesan Nyata</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                Penerima #{sampleRecipient?.id || 1}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Simulasi tampilan pesan yang akan diterima di aplikasi WhatsApp kontak.
            </p>

            {/* Missing Variable Warning */}
            {missingVariables.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs flex items-start space-x-2">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Variabel tidak ditemukan di dataset:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {missingVariables.map((v) => (
                      <span key={v} className="font-mono bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Smartphone Chat Bubble */}
            <div className="p-4 rounded-2xl bg-[#ECE5DD] dark:bg-[#0B141A] min-h-[300px] border border-slate-300 dark:border-slate-800 flex flex-col justify-end">
              <div className="bg-[#E7FFDB] dark:bg-[#005C4B] text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tr-none shadow max-w-[90%] self-end space-y-2 border border-emerald-100 dark:border-emerald-800/40">
                {/* Image in Bubble */}
                {imagePreviewUrl && (
                  <div className="rounded-xl overflow-hidden mb-2">
                    <img
                      src={imagePreviewUrl}
                      alt="Attachment Preview"
                      className="w-full h-44 object-cover"
                    />
                  </div>
                )}

                {/* Message Text with resolved variables */}
                <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans">
                  {previewResolvedText || (
                    <span className="text-slate-400 italic">Ketik pesan pada form di sebelah kiri...</span>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 dark:text-emerald-200/60 text-right font-medium">
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>

            {/* Target Summary */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Target Kontak:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {sampleRecipient ? `${sampleRecipient.name} (${sampleRecipient.phone_number})` : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
