"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Upload, FileSpreadsheet, Zap, ChevronDown } from "lucide-react";

const bulanList = [
  { value: "Januari",   label: "Januari" },
  { value: "Februari",  label: "Februari" },
  { value: "Maret",     label: "Maret" },
  { value: "April",     label: "April" },
  { value: "Mei",       label: "Mei" },
  { value: "Juni",      label: "Juni" },
  { value: "Juli",      label: "Juli" },
  { value: "Agustus",   label: "Agustus" },
  { value: "September", label: "September" },
  { value: "Oktober",   label: "Oktober" },
  { value: "November",  label: "November" },
  { value: "Desember",  label: "Desember" },
];

const jenisList = ["TCU", "IKT", "PTP", "SPMT"];

type AlertType = "success" | "error" | null;

export default function UploadMappingPage() {
  const [file, setFile]                 = useState<File | null>(null);
  const [type, setType]                 = useState("TCU");
  const [bulan, setBulan]               = useState("Desember");
  const [tahun, setTahun]               = useState(2025);
  const [loading, setLoading]           = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [dragOver, setDragOver]         = useState(false);
  const [alertType, setAlertType]       = useState<AlertType>(null);
  const [alertMsg, setAlertMsg]         = useState("");

  const showAlert = (type: AlertType, msg: string) => {
    setAlertType(type);
    setAlertMsg(msg);
    setTimeout(() => setAlertType(null), 6000);
  };

  const handleUpload = async () => {
    if (!file) { showAlert("error", "Pilih file terlebih dahulu!"); return; }
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch("/api/admin/upload-mapping-jabatan", {
        method: "POST",
        body: JSON.stringify({ file: Array.from(new Uint8Array(buffer)), type, bulan, tahun }),
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (result.success) {
        showAlert("success", `Upload berhasil! ${result.inserted || 0} baris mapping tersimpan. Sekarang klik Terapkan Mapping.`);
      } else {
        showAlert("error", result.message || "Gagal upload mapping");
      }
    } catch {
      showAlert("error", "Terjadi kesalahan saat upload.");
    }
    setLoading(false);
  };

  const handleApply = async () => {
    setLoadingApply(true);
    try {
      const res = await fetch("/api/admin/apply-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, bulan, tahun }),
      });
      const result = await res.json();
      if (result.success) {
        showAlert("success", `Mapping diterapkan! ${result.updated} data diupdate, ${result.skipped || 0} tidak cocok.`);
      } else {
        showAlert("error", result.message || "Gagal menerapkan mapping");
      }
    } catch {
      showAlert("error", "Terjadi kesalahan saat menerapkan mapping.");
    }
    setLoadingApply(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
      setFile(dropped);
    } else {
      showAlert("error", "Format file harus .xlsx atau .xls");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Mapping Jabatan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload file Excel mapping untuk mengisi kolom Pusat Pelayanan dan Operasional secara otomatis
        </p>
      </div>

      {/* Alert */}
      {alertType && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
          alertType === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {alertType === "success"
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          File harus berisi kolom:{" "}
          <span className="font-semibold">Jabatan</span>,{" "}
          <span className="font-semibold">Pusat Pelayanan</span>, dan{" "}
          <span className="font-semibold">Operasional</span>
        </p>
      </div>

      {/* Main Card - full width */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

        {/* ── STEP 1: Pilih Periode ── */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pilih Periode & Jenis Data</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Jenis Data */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Jenis Data</label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
                >
                  {jenisList.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Bulan */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Bulan</label>
              <div className="relative">
                <select
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
                >
                  {bulanList.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Tahun */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tahun</label>
              <input
                type="number"
                value={tahun}
                onChange={(e) => setTahun(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Data akan disimpan dengan periode:{" "}
            <span className="font-semibold text-blue-600">{bulan} / {tahun}</span>
          </p>
        </div>

        {/* ── STEP 2: Upload File ── */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pilih File Mapping</h2>
          </div>

          {/* Dropzone — full width */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0] || null; if (f) setFile(f); }}
            />
            {file ? (
              <>
                <CheckCircle className="w-9 h-9 text-green-500 mb-2" />
                <p className="text-sm font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-green-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB · Klik untuk ganti file
                </p>
              </>
            ) : (
              <>
                <Upload className="w-9 h-9 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-600">
                  Drag & drop atau{" "}
                  <span className="text-blue-600 underline">klik untuk pilih file</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Format: .xlsx, .xls</p>
              </>
            )}
          </label>

          {/* Upload Button — full width */}
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className={`mt-4 w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              loading || !file
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm"
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Mengupload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Mapping
              </>
            )}
          </button>
        </div>

        {/* ── STEP 3: Apply ── */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Terapkan Mapping ke Data</h2>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Setelah upload berhasil, klik tombol di bawah untuk menerapkan mapping ke data{" "}
            <span className="font-semibold text-gray-700">{type}</span> periode{" "}
            <span className="font-semibold text-gray-700">{bulan} {tahun}</span>.
          </p>

          {/* Apply Button — full width */}
          <button
            onClick={handleApply}
            disabled={loadingApply}
            className={`w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              loadingApply
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-sm"
            }`}
          >
            {loadingApply ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Menerapkan...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Terapkan Mapping ke Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Panduan — full width */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Cara Penggunaan</h3>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: "1", title: "Pilih Periode", text: "Pilih Jenis Data, Bulan, dan Tahun yang sesuai dengan data yang sudah diupload." },
            { step: "2", title: "Pilih File",    text: "Pilih file Excel mapping yang berisi kolom Jabatan, Pusat Pelayanan, dan Operasional." },
            { step: "3", title: "Upload",         text: "Klik Upload Mapping untuk menyimpan data mapping ke dalam sistem." },
            { step: "4", title: "Terapkan",       text: "Klik Terapkan Mapping untuk mengisi kolom Pusat Pelayanan dan Operasional secara otomatis." },
          ].map(({ step, title, text }) => (
            <li key={step} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {step}
                </span>
                <span className="text-sm font-semibold text-gray-700">{title}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </div>

    </div>
  );
}