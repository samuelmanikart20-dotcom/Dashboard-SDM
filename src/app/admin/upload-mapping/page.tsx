"use client";

import { useState } from "react";

const bulanList = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

export default function UploadMappingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("TCU");
  const [bulan, setBulan] = useState("Desember");
  const [tahun, setTahun] = useState(2025);
  const [loading, setLoading] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);

  // =========================
  // 🔥 UPLOAD MAPPING
  // =========================
  const handleUpload = async () => {
    if (!file) return alert("❌ Pilih file dulu!");

    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();

      const res = await fetch("/api/admin/upload-mapping-jabatan", {
        method: "POST",
        body: JSON.stringify({
          file: Array.from(new Uint8Array(buffer)),
          type,
          bulan,
          tahun,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await res.json();

      if (result.success) {
        alert("✅ Mapping berhasil diupload!\nSekarang klik tombol TERAPKAN MAPPING");
      } else {
        alert("❌ Gagal upload mapping");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error upload");
    }

    setLoading(false);
  };

  // =========================
  // 🔥 APPLY MAPPING (INI KUNCI)
  // =========================
  const handleApplyMapping = async () => {
    setLoadingApply(true);

    try {
      const res = await fetch("/api/admin/apply-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          bulan,
          tahun,
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert(`🔥 Mapping berhasil diterapkan!\nUpdate: ${result.updated} data`);
        window.location.reload(); // 🔥 refresh dashboard
      } else {
        alert("❌ Gagal apply mapping");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error apply mapping");
    }

    setLoadingApply(false);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-2xl mx-auto">

        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Upload Mapping Jabatan
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">

          {/* INFO */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-700">
            📌 File harus berisi: <b>Jabatan, Pusat Pelayanan, Operasional</b>
          </div>

          {/* TYPE */}
          <div>
            <label className="block mb-2 font-medium">Jenis Data</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border px-3 py-2 rounded text-black"
            >
              <option value="TCU">TCU</option>
              <option value="IKT">IKT</option>
              <option value="PTP">PTP</option>
              <option value="SPMT">SPMT</option>
            </select>
          </div>

          {/* BULAN */}
          <div>
            <label className="block mb-2 font-medium">Bulan</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="w-full border px-3 py-2 rounded text-black"
            >
              {bulanList.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* TAHUN */}
          <div>
            <label className="block mb-2 font-medium">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="w-full border px-3 py-2 rounded text-black"
            />
          </div>

          {/* FILE */}
          <div className="border-2 border-dashed p-6 text-center rounded-xl">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="mt-2 text-green-600 text-sm">
                ✅ {file.name}
              </p>
            )}
          </div>

          {/* BUTTON UPLOAD */}
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl"
          >
            {loading ? "Uploading..." : "Upload Mapping"}
          </button>

          {/* 🔥 BUTTON APPLY (INI YANG BIKIN KEISI) */}
          <button
            onClick={handleApplyMapping}
            disabled={loadingApply}
            className="w-full bg-blue-600 text-white py-3 rounded-xl"
          >
            {loadingApply ? "Menerapkan..." : "🔥 Terapkan Mapping ke Data"}
          </button>

        </div>
      </div>
    </div>
  );
}