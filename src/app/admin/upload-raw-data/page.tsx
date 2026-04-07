"use client";

import { useState } from "react";

export default function UploadRawDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("TCU");
  const [bulan, setBulan] = useState(1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert("Pilih file dulu!");
      return;
    }

    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();

      const res = await fetch("/api/admin/upload-raw", {
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

      // 🔥 ambil raw response dulu
      const text = await res.text();
      console.log("🔥 RAW RESPONSE:", text);

      let result: any;

      try {
        result = JSON.parse(text);
      } catch (err) {
        alert("❌ Response bukan JSON (API error)");
        setLoading(false);
        return;
      }

      console.log("🔥 HASIL API FULL:", result);

      // 🔥 tampilkan detail error biar jelas
      if (result.success) {
        alert(`🔥 Upload berhasil!\nTotal data: ${result.total}`);
      } else {
        alert(`❌ Upload gagal:\n${result.message}`);
      }

    } catch (err) {
      console.error("ERROR:", err);
      alert("❌ Error upload (cek console)");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload Data Mentah</h1>

      <div className="bg-white p-6 rounded shadow space-y-4">

        {/* Jenis Data */}
        <div>
          <label className="block mb-2 font-medium">Jenis Data</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border px-3 py-2 rounded w-full text-black"
          >
            <option value="TCU">TCU</option>
            <option value="PTP">PTP</option>
            <option value="SPMT">SPMT</option>
            <option value="IKT">IKT</option>
          </select>
        </div>

        {/* Bulan */}
        <div>
          <label className="block mb-2 font-medium">Bulan</label>
          <input
            type="number"
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full text-black"
          />
        </div>

        {/* Tahun */}
        <div>
          <label className="block mb-2 font-medium">Tahun</label>
          <input
            type="number"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full text-black"
          />
        </div>

        {/* Upload File */}
        <div>
          <label className="block mb-2 font-medium">Upload File</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-black"
          />
        </div>

        {/* Button */}
        <button
          onClick={handleUpload}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Uploading..." : "Upload Sekarang"}
        </button>

      </div>
    </div>
  );
}