"use client";

import { useEffect, useState, useRef } from "react";
import { FiUpload, FiTrash2, FiDownload } from "react-icons/fi";

interface MutasiRow {
  id: number;
  entitas: string;
  jenis: "PENAMBAHAN" | "PENGURANGAN";
  bulan: number;
  tahun: number;
  nama: string;
  status_pekerjaan: string;
  keterangan_penambahan: string;
  tmt: string;
  keterangan: string;
}

const BULAN_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ENTITAS_LIST = ["SPMT", "PTP", "IKT", "TCU"];

const TAHUN_LIST = Array.from({ length: 13 }, (_, i) => String(2024 + i));
// hasil: ["2024","2025","2026",...,"2036"]

export default function MutasiPage() {
  // ─── Filter state ───
  const [filterBulan, setFilterBulan] = useState(
    String(new Date().getMonth() + 1)
  );
  const [filterTahun, setFilterTahun] = useState(
    String(new Date().getFullYear())
  );
  const [filterEntitas, setFilterEntitas] = useState("");
  const [filterJenis, setFilterJenis] = useState("");

  // ─── Data state ───
  const [data, setData] = useState<MutasiRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── Upload state ───
  const [uploadBulan, setUploadBulan] = useState(
    String(new Date().getMonth() + 1)
  );
  const [uploadTahun, setUploadTahun] = useState(
    String(new Date().getFullYear())
  );
  const [uploadEntitas, setUploadEntitas] = useState("SPMT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Export state ───
  const [exporting, setExporting] = useState(false);

  // ─── Delete state ───
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteBulan, setDeleteBulan] = useState("");
  const [deleteTahun, setDeleteTahun] = useState("");
  const [deleteEntitas, setDeleteEntitas] = useState("SPMT");
  const [deleting, setDeleting] = useState(false);

  // ─── Fetch data ───
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBulan) params.append("bulan", filterBulan);
      if (filterTahun) params.append("tahun", filterTahun);
      if (filterEntitas) params.append("entitas", filterEntitas);
      if (filterJenis) params.append("jenis", filterJenis);

      const res = await fetch(`/api/admin/mutasi-sdm?${params.toString()}`);
      const json = await res.json();
      setData(json.success ? json.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBulan, filterTahun, filterEntitas, filterJenis]);

  // ─── Summary ───
  const penambahan = data.filter((r) => r.jenis === "PENAMBAHAN");
  const pengurangan = data.filter((r) => r.jenis === "PENGURANGAN");

  // ─── Cek apakah export diizinkan ───
  const canExport = !!filterBulan && !!filterEntitas;

  // ─── Export handler ───
  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("export", "excel");
      params.append("bulan", filterBulan);
      if (filterTahun) params.append("tahun", filterTahun);
      params.append("entitas", filterEntitas);

      const res = await fetch(`/api/admin/mutasi-sdm?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Gagal export");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : "Mutasi_SDM.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Terjadi kesalahan saat export");
    } finally {
      setExporting(false);
    }
  };

  // ─── Upload handler ───
  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadMsg({ type: "error", text: "Pilih file Excel terlebih dahulu" });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("bulan", uploadBulan);
      form.append("tahun", uploadTahun);
      form.append("entitas", uploadEntitas);

      const res = await fetch("/api/admin/mutasi-sdm", {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (json.success) {
        setUploadMsg({ type: "success", text: json.message });
        setUploadFile(null);
        if (fileRef.current) fileRef.current.value = "";
        fetchData();
      } else {
        setUploadMsg({ type: "error", text: json.error || "Upload gagal" });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Terjadi kesalahan saat upload" });
    } finally {
      setUploading(false);
    }
  };

  // ─── Delete handler ───
  const handleDelete = async () => {
    if (!deleteBulan || !deleteTahun) {
      alert("Pilih bulan dan tahun terlebih dahulu");
      return;
    }
    setDeleting(true);
    try {
      const params = new URLSearchParams({
        bulan: deleteBulan,
        tahun: deleteTahun,
        entitas: deleteEntitas,
      });
      const res = await fetch(`/api/admin/mutasi-sdm?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        alert(`Berhasil menghapus ${json.deleted} data`);
        setDeleteModal(false);
        fetchData();
      } else {
        alert(json.error || "Gagal menghapus");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          MONITORING MUTASI SDM
        </h1>
        <p className="text-gray-500 mt-1">
          Monitoring pegawai penambahan dan pengurangan per entitas
        </p>
      </div>

      {/* ── UPLOAD SECTION ── */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <FiUpload className="text-blue-600" />
          Upload Data Mutasi
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Entitas */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Entitas
            </label>
            <select
              value={uploadEntitas}
              onChange={(e) => setUploadEntitas(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-gray-800"
            >
              {ENTITAS_LIST.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Bulan */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Bulan
            </label>
            <select
              value={uploadBulan}
              onChange={(e) => setUploadBulan(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-gray-800"
            >
              {BULAN_NAMES.slice(1).map((b, i) => (
                <option key={i + 1} value={String(i + 1)}>{b}</option>
              ))}
            </select>
          </div>

          {/* Tahun — sekarang dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Tahun
            </label>
            <select
              value={uploadTahun}
              onChange={(e) => setUploadTahun(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-gray-800"
            >
              {TAHUN_LIST.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* File */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              File Excel (.xlsx)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full border rounded-lg px-3 py-2 text-gray-800 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${
              uploading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <FiUpload />
            {uploading ? "Mengupload..." : "Upload"}
          </button>

          <button
            onClick={() => setDeleteModal(true)}
            className="px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 bg-red-600 hover:bg-red-700"
          >
            <FiTrash2 />
            Hapus Data
          </button>
        </div>

        {uploadMsg && (
          <div
            className={`mt-3 px-4 py-3 rounded-lg text-sm font-medium ${
              uploadMsg.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {uploadMsg.text}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Format file: Excel dengan sheet <strong>PENAMBAHAN</strong> dan{" "}
          <strong>PENGURANGAN</strong>. Kolom wajib: Nama, Status Pekerjaan,
          Keterangan Penambahan/Pengurangan, TMT, Keterangan.
        </p>
      </div>

      {/* ── FILTER ── */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-600 mb-3">Filter Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Filter Bulan */}
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Bulan</option>
            {BULAN_NAMES.slice(1).map((b, i) => (
              <option key={i + 1} value={String(i + 1)}>{b}</option>
            ))}
          </select>

          {/* Filter Tahun — sekarang dropdown */}
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Tahun</option>
            {TAHUN_LIST.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Filter Entitas */}
          <select
            value={filterEntitas}
            onChange={(e) => setFilterEntitas(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Entitas</option>
            {ENTITAS_LIST.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          {/* Filter Jenis */}
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Penambahan & Pengurangan</option>
            <option value="PENAMBAHAN">Penambahan</option>
            <option value="PENGURANGAN">Pengurangan</option>
          </select>
        </div>

        {/* ── TOMBOL EXPORT ── */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!canExport || exporting}
            className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors ${
              !canExport
                ? "bg-gray-300 cursor-not-allowed text-gray-500"
                : exporting
                ? "bg-emerald-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <FiDownload />
            {exporting ? "Mengexport..." : "Export Excel"}
          </button>

          {!canExport && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠️ Pilih <strong>Bulan</strong> dan <strong>Entitas</strong> terlebih dahulu untuk export
            </p>
          )}

          {canExport && (
            <p className="text-xs text-gray-500">
              Export data{" "}
              <strong>
                {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun} — {filterEntitas}
              </strong>
            </p>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm mb-1">Total Penambahan</p>
          <p className="text-4xl font-bold text-green-600">{penambahan.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-red-500">
          <p className="text-gray-500 text-sm mb-1">Total Pengurangan</p>
          <p className="text-4xl font-bold text-red-600">{pengurangan.length}</p>
        </div>
      </div>

      {/* ── TABEL PENAMBAHAN ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <div className="bg-green-600 text-white px-6 py-4">
          <h2 className="text-lg font-bold">
            PENAMBAHAN SDM ({penambahan.length} orang)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-50 text-green-800 border-b border-green-200">
                <th className="px-4 py-3 text-left font-semibold">No</th>
                <th className="px-4 py-3 text-left font-semibold">Nama</th>
                <th className="px-4 py-3 text-left font-semibold">Status Pekerjaan</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan Penambahan</th>
                <th className="px-4 py-3 text-left font-semibold">TMT</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-left font-semibold">Entitas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : penambahan.length > 0 ? (
                penambahan.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.nama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {row.status_pekerjaan || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.keterangan_penambahan || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.tmt || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.keterangan || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {row.entitas}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Tidak ada data penambahan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABEL PENGURANGAN ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <div className="bg-red-600 text-white px-6 py-4">
          <h2 className="text-lg font-bold">
            PENGURANGAN SDM ({pengurangan.length} orang)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50 text-red-800 border-b border-red-200">
                <th className="px-4 py-3 text-left font-semibold">No</th>
                <th className="px-4 py-3 text-left font-semibold">Nama</th>
                <th className="px-4 py-3 text-left font-semibold">Status Pekerjaan</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan Pengurangan</th>
                <th className="px-4 py-3 text-left font-semibold">TMT</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-left font-semibold">Entitas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : pengurangan.length > 0 ? (
                pengurangan.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.nama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {row.status_pekerjaan || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.keterangan_penambahan || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.tmt || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.keterangan || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {row.entitas}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Tidak ada data pengurangan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DELETE MODAL ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeleteModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FiTrash2 className="text-red-600" />
              Hapus Data Mutasi
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Entitas</label>
                <select
                  value={deleteEntitas}
                  onChange={(e) => setDeleteEntitas(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-800"
                >
                  {ENTITAS_LIST.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Bulan</label>
                <select
                  value={deleteBulan}
                  onChange={(e) => setDeleteBulan(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-800"
                >
                  <option value="">Pilih Bulan</option>
                  {BULAN_NAMES.slice(1).map((b, i) => (
                    <option key={i + 1} value={String(i + 1)}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Tahun di modal delete — sekarang dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Tahun</label>
                <select
                  value={deleteTahun}
                  onChange={(e) => setDeleteTahun(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-800"
                >
                  <option value="">Pilih Tahun</option>
                  {TAHUN_LIST.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-sm text-red-600 mb-4">
              ⚠️ Semua data mutasi {deleteEntitas} bulan{" "}
              {BULAN_NAMES[parseInt(deleteBulan)] || "..."} {deleteTahun} akan
              dihapus permanen.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}