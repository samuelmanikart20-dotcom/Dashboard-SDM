"use client";

import { useState } from "react";

export default function UploadRawDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("TCU");
  const [bulan, setBulan] = useState(12);
  const [tahun, setTahun] = useState(2025);
  const [loading, setLoading] = useState(false);

  const bulanList = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  const handleUpload = async () => {
    if (!file) {
      alert("Pilih file dulu!");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      // 🔥 INI WAJIB (JANGAN DIUBAH)
      formData.append("file", file);
      formData.append("type", type);
      formData.append("bulan", String(bulan));
      formData.append("tahun", String(tahun));

      const res = await fetch("/api/admin/upload-raw", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      console.log("RESULT:", result);

      if (!res.ok) {
        alert("Upload gagal: " + result.message);
        return;
      }

      const namaBulan =
        bulanList.find((b) => b.value === bulan)?.label || bulan;

      alert(
        `✅ Upload berhasil!\n\nJenis: ${type}\nBulan: ${namaBulan}\nTahun: ${tahun}\nTotal data: ${
          result.total_data || result.total
        }`
      );
    } catch (err) {
      console.error(err);
      alert("❌ Error upload");
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
          <select
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full text-black"
          >
            {bulanList.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
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
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          {loading ? "Uploading..." : "Upload Sekarang"}
        </button>

      </div>
    </div>
  );
}