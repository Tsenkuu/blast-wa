import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Edit2,
  Eye,
  Search,
  Plus,
  RefreshCw,
  FileText
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.js';
import { Dataset } from '../types/index.js';

export const ExcelManager: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [activeDataset, setActiveDataset] = useState<any>(null);

  // Upload & Preview state
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Column Mapping
  const [phoneCol, setPhoneCol] = useState('A');
  const [nameCol, setNameCol] = useState('B');
  const [notesCol, setNotesCol] = useState('C');

  // Contacts Pagination in View Modal
  const [contactsPage, setContactsPage] = useState(1);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/excel/datasets');
      if (res.data?.success) {
        setDatasets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!datasetName) {
        // Auto-generate clean dataset name from filename
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setDatasetName(`Data ${cleanName}`);
      }

      // Generate preview
      setPreviewLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await api.post('/excel/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data?.success) {
          setPreviewData(res.data.data);
        }
      } catch (err: any) {
        setMessage({ text: err.response?.data?.message || 'Gagal membaca preview Excel', type: 'error' });
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleImport = async () => {
    if (!file || !datasetName) {
      setMessage({ text: 'Harap pilih file Excel dan beri nama dataset.', type: 'error' });
      return;
    }

    setImporting(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', datasetName);
    formData.append('phoneCol', phoneCol);
    formData.append('nameCol', nameCol);
    formData.append('notesCol', notesCol);

    try {
      const res = await api.post('/excel/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setMessage({ text: res.data.message, type: 'success' });
        setUploadModalOpen(false);
        setFile(null);
        setDatasetName('');
        setPreviewData(null);
        fetchDatasets();
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Gagal mengimpor Excel', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleViewDataset = async (id: number) => {
    try {
      const res = await api.get(`/excel/datasets/${id}?page=${contactsPage}&limit=20`);
      if (res.data?.success) {
        setActiveDataset(res.data.data);
        setViewModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to view dataset:', err);
    }
  };

  const handleDeleteDataset = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus dataset ini beserta seluruh kontaknya?')) return;
    try {
      const res = await api.delete(`/excel/datasets/${id}`);
      if (res.data?.success) {
        fetchDatasets();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus dataset');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pengelolaan Dataset Excel</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Impor kontak massal (.xlsx / .xls), mapping kolom dinamis, deteksi duplikat, dan konversi otomatis ke 628
          </p>
        </div>

        <button
          onClick={() => {
            setFile(null);
            setDatasetName('');
            setPreviewData(null);
            setUploadModalOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Upload File Excel</span>
        </button>
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

      {/* Dataset List Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Daftar Dataset Tersimpan</h3>
          <button
            onClick={fetchDatasets}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Memuat data...</div>
        ) : datasets.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Belum ada dataset yang diupload. Klik <strong>Upload File Excel</strong> untuk menambahkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Nama Dataset</th>
                  <th className="py-3 px-4">Nama File Asli</th>
                  <th className="py-3 px-4 text-center">Total Baris</th>
                  <th className="py-3 px-4 text-center">Valid (628)</th>
                  <th className="py-3 px-4 text-center">Tidak Valid</th>
                  <th className="py-3 px-4">Dibuat Oleh</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <FileSpreadsheet size={16} className="text-emerald-500" />
                      <span>{d.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{d.filename}</td>
                    <td className="py-3 px-4 text-center font-semibold">{d.total_rows}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {d.valid_rows}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                      {d.invalid_rows}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{d.created_by}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(d.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewDataset(d.id)}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition"
                        title="Lihat Data"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDataset(d.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Hapus Dataset"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload & Preview Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload & Preview File Excel"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Pilih File Excel (.xlsx / .xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-950/50 dark:file:text-brand-400 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Nama Dataset
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Contoh: Data Relawan November"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {previewLoading && (
            <div className="p-6 text-center text-xs text-slate-400">
              Sedang menganalisis struktur baris dan kolom Excel...
            </div>
          )}

          {previewData && (
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              {/* Validation Summary Badges */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div className="text-slate-400 text-[10px]">Total Baris</div>
                  <div className="font-bold text-slate-800 dark:text-white text-sm">{previewData.totalRows}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <div className="text-[10px]">Nomor Valid</div>
                  <div className="font-bold text-sm">{previewData.validRows}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <div className="text-[10px]">Tidak Valid</div>
                  <div className="font-bold text-sm">{previewData.invalidRows}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <div className="text-[10px]">Duplikat</div>
                  <div className="font-bold text-sm">{previewData.duplicateRows}</div>
                </div>
              </div>

              {/* Dynamic Column Mapping Controls */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Pemetaan Kolom (Column Mapping)
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Kolom Nomor WhatsApp:</label>
                    <select
                      value={phoneCol}
                      onChange={(e) => setPhoneCol(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-xs"
                    >
                      {previewData.columns.map((c: any) => (
                        <option key={c.letter} value={c.letter}>
                          {c.letter} ({c.header})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Kolom Nama:</label>
                    <select
                      value={nameCol}
                      onChange={(e) => setNameCol(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-xs"
                    >
                      {previewData.columns.map((c: any) => (
                        <option key={c.letter} value={c.letter}>
                          {c.letter} ({c.header})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Kolom Keterangan:</label>
                    <select
                      value={notesCol}
                      onChange={(e) => setNotesCol(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-xs"
                    >
                      {previewData.columns.map((c: any) => (
                        <option key={c.letter} value={c.letter}>
                          {c.letter} ({c.header})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sample Rows Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Pratinjau Data (10 Baris Pertama)
                </h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Nomor WhatsApp</th>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewData.sampleRows.map((r: any, idx: number) => (
                        <tr key={idx} className={r.isValid ? '' : 'bg-rose-50/50 dark:bg-rose-950/20'}>
                          <td className="py-1.5 px-3">{r.rowNumber}</td>
                          <td className="py-1.5 px-3 font-mono">{r.normalizedPhone || r.phone}</td>
                          <td className="py-1.5 px-3">{r.name}</td>
                          <td className="py-1.5 px-3">
                            {r.isValid ? (
                              <span className="text-emerald-600 font-bold">Valid</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{r.errorReason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setUploadModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !file || !datasetName}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {importing ? 'Menyimpan...' : 'Simpan Dataset ke Database'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Dataset Details Modal */}
      {activeDataset && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Detail Dataset: ${activeDataset.dataset.name}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Total Kontak:</span>
                <span className="font-bold ml-2 text-slate-900 dark:text-white">
                  {activeDataset.pagination.total}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                <span>Kontak Valid:</span>
                <span className="font-bold ml-2">{activeDataset.dataset.valid_rows}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
                <span>Tidak Valid:</span>
                <span className="font-bold ml-2">{activeDataset.dataset.invalid_rows}</span>
              </div>
            </div>

            {/* Contacts Table */}
            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Nomor WhatsApp</th>
                    <th className="py-2.5 px-3">Nama</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3">Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeDataset.contacts.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-mono font-semibold">{c.phone_number}</td>
                      <td className="py-2 px-3">{c.name || '-'}</td>
                      <td className="py-2 px-3 text-slate-500">{c.notes || '-'}</td>
                      <td className="py-2 px-3">
                        {c.is_valid === 1 ? (
                          <span className="text-emerald-600 font-bold">Valid</span>
                        ) : (
                          <span className="text-rose-600 font-semibold">{c.validation_error || 'Gagal validasi'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 text-xs text-slate-500">
              <span>
                Menampilkan halaman {activeDataset.pagination.page} dari {activeDataset.pagination.totalPages || 1}
              </span>
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200"
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
