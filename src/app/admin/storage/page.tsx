"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaTrash } from "react-icons/fa";
import { useAlert } from "@/utils/alert";

type Dataset = {
  id: number;
  name: string;
  original_filename: string | null;
  columns: string[];
  total_rows: number;
  created_at: string;
};

type DatasetsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: Dataset[];
};

type RecordsResponse = {
  dataset: { id: number; name: string; columns: string[]; total_rows: number };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  records: { id: number; created_at: string; data: Record<string, any> }[];
};

export default function StoragePage() {
  const { alert, confirm, AlertComponent } = useAlert();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");

  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [recordLimit] = useState(20);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const columns = useMemo(() => activeDataset?.columns || [], [activeDataset]);

  async function fetchDatasets(p = page, query = q) {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
      });
      if (query) params.set("q", query);
      const res = await fetch(
        `/api/admin/storage/datasets?${params.toString()}`
      );
      const data: DatasetsResponse = await res.json();
      setDatasets(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    fetchDatasets(1, q);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    fetchDatasets(page, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (datasetName) form.append("name", datasetName);
      const res = await fetch("/api/admin/storage/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal upload");
      setFile(null);
      setDatasetName("");
      fetchDatasets(1, q);
      setPage(1);
      alert("Upload berhasil", "success");
    } catch (err: any) {
      alert(err.message || "Gagal upload", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(datasetId: number) {
    confirm({
      title: "Konfirmasi Hapus",
      message: "Yakin ingin menghapus dataset ini? Tindakan ini tidak dapat dibatalkan.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/storage/datasets/${datasetId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Gagal menghapus dataset");
          if (activeDataset?.id === datasetId) resetViewer();
          await fetchDatasets(page, q);
          alert("Dataset berhasil dihapus", "success");
        } catch (err: any) {
          alert(err?.message || "Gagal menghapus dataset", "error");
        }
      },
    });
  }

  async function openDataset(ds: Dataset, p = 1) {
    setActiveDataset(ds);
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(recordLimit),
      });
      const res = await fetch(
        `/api/admin/storage/datasets/${ds.id}/records?${params.toString()}`
      );
      const data: RecordsResponse = await res.json();
      setRecords(data);
      setRecordPage(data.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecords(false);
    }
  }

  function resetViewer() {
    setActiveDataset(null);
    setRecords(null);
    setRecordPage(1);
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Storage - Import/Export
      </h1>

      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Upload Dataset
        </h2>
        <form
          onSubmit={handleUpload}
          className="grid gap-4 grid-cols-1 md:grid-cols-3 items-end"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Dataset (opsional)
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Contoh: Data Karyawan September"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File (CSV/XLSX)
            </label>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border rounded-lg px-3 py-2 bg-white text-gray-800"
              required
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex items-center justify-center w-full md:w-auto px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Mengunggah..." : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Datasets List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 lg:p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Daftar Dataset
          </h2>
          <input
            type="text"
            placeholder="Cari nama / filename..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-72 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm table-fixed border-separate border-spacing-0">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">No</th>
                <th className="px-4 py-3 text-left font-semibold">Nama</th>
                <th className="px-4 py-3 text-left font-semibold">File Asli</th>
                <th className="px-4 py-3 text-left font-semibold">Kolom</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Total Baris
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  Dibuat
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    Memuat...
                  </td>
                </tr>
              ) : datasets.length === 0 ? (
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    Belum ada dataset
                  </td>
                </tr>
              ) : (
                datasets.map((ds, index) => (
                  <tr key={ds.id} className="border-t hover:bg-gray-50">
                    <td className="text-gray-800 px-4 py-3 font-medium">
                      {index + 1}
                    </td>
                    <td className="text-gray-800 px-4 py-3 font-medium">
                      {ds.name}
                    </td>
                    <td className="px-4 py-3 text-gray-800 break-words max-w-[150px]">
                      {ds.original_filename || "-"}
                    </td>
                    <td className="text-gray-800 px-4 py-3">
                      {ds.columns.length}
                    </td>
                    <td className="text-gray-800 px-4 py-3">{ds.total_rows}</td>
                    <td className="text-gray-800 px-4 py-3 whitespace-nowrap">
                      {new Date(ds.created_at).toLocaleString()}
                    </td>
                    <td className="text-gray-800 px-4 py-3 space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openDataset(ds, 1)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Lihat
                      </button>
                      <a
                        href={`/api/admin/storage/datasets/${ds.id}/export?format=csv`}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
                      >
                        Export CSV
                      </a>
                      <a
                        href={`/api/admin/storage/datasets/${ds.id}/export?format=xlsx`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Export XLSX
                      </a>
                      <button
                        onClick={() => handleDelete(ds.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm">
          <span>
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 rounded border disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Sebelumnya
            </button>
            <button
              className="px-3 py-1.5 rounded border disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Viewer */}
      {activeDataset && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 lg:p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {activeDataset.name}
              </h2>
              <p className="text-sm text-gray-500">
                {activeDataset.total_rows} baris • {columns.length} kolom
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/admin/storage/datasets/${activeDataset.id}/export?format=csv`}
                className="px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
              >
                Export CSV
              </a>
              <a
                href={`/api/admin/storage/datasets/${activeDataset.id}/export?format=xlsx`}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Export XLSX
              </a>
              <button
                onClick={resetViewer}
                className="px-3 py-1.5 rounded-lg border text-gray-800"
              >
                Tutup
              </button>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            {loadingRecords ? (
              <div>Memuat data...</div>
            ) : !records || records.records.length === 0 ? (
              <div className="py-8 text-gray-600">Tidak ada data</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    {columns.map((c) => (
                      <th key={c} className="px-4 py-3 text-left font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.records.map((r, idx) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                        {(recordPage - 1) * recordLimit + idx + 1}
                      </td>
                      {columns.map((c) => (
                        <td
                          key={c}
                          className="px-4 py-3 whitespace-nowrap text-gray-800"
                        >
                          {String(r.data?.[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {records && records.totalPages > 1 && (
            <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-gray-800">
              <span>
                Halaman {recordPage} dari {records.totalPages}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-1.5 rounded border disabled:opacity-50"
                  onClick={() =>
                    openDataset(activeDataset, Math.max(1, recordPage - 1))
                  }
                  disabled={recordPage <= 1}
                >
                  Sebelumnya
                </button>
                <button
                  className="px-3 py-1.5 rounded border disabled:opacity-50"
                  onClick={() =>
                    openDataset(
                      activeDataset,
                      Math.min(records.totalPages, recordPage + 1)
                    )
                  }
                  disabled={recordPage >= records.totalPages}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <AlertComponent />
    </div>
  );
}
