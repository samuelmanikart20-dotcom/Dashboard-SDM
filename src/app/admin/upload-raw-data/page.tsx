"use client";

import { useState } from "react";

export default function UploadRawDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("TCU");
  const [bulan, setBulan] = useState(4);
  const [tahun, setTahun] = useState(2026);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const bulanList = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // LIST TAHUN 2023 - 2036
  const tahunList = Array.from({ length: 14 }, (_, i) => 2023 + i);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("bulan", String(bulan));
      formData.append("tahun", String(tahun));

      const res = await fetch("/api/admin/upload-raw", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        alert("Upload gagal: " + result.message);
        return;
      }

      alert("Upload berhasil!");
    } catch (err) {
      console.error(err);
      alert("Error upload");
    }

    setLoading(false);
    setShowModal(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Upload Data Mentah</h1>
        <p className="text-gray-500">
          Upload file Excel atau CSV untuk memproses data mentah
        </p>
      </div>

      {/* DOWNLOAD TEMPLATE */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center">
        <div>
          <p className="font-medium text-blue-700">Download Template</p>
          <p className="text-sm text-blue-500">
            Gunakan format yang sesuai agar data berhasil diproses
          </p>
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Download Template
        </button>
      </div>

      {/* CARD */}
      <div className="bg-white p-6 rounded-xl shadow space-y-6">
        {/* PERIODE */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="font-semibold mb-3">Pilih Periode Data</p>

          <div className="grid grid-cols-2 gap-4">
            {/* BULAN */}
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="border px-3 py-2 rounded w-full"
            >
              {bulanList.map((b, i) => (
                <option key={i} value={i + 1}>
                  {b}
                </option>
              ))}
            </select>

            {/* TAHUN */}
            <select
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="border px-3 py-2 rounded w-full"
            >
              {tahunList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-gray-500 mt-2">
            Data akan disimpan dengan periode:{" "}
            <span className="text-blue-600 font-semibold">
              {bulan}/{tahun}
            </span>
          </p>
        </div>

        {/* JENIS DATA */}
        <div>
          <label className="block mb-2 font-medium">Jenis Data</label>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border px-3 py-2 rounded w-full"
          >
            <option value="TCU">TCU</option>
            <option value="PTP">PTP</option>
            <option value="SPMT">SPMT</option>
            <option value="IKT">IKT</option>
          </select>
        </div>

        {/* UPLOAD BOX */}
        <div
          className="border-2 border-dashed border-blue-300 rounded-lg p-10 text-center cursor-pointer hover:bg-blue-50"
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <p className="text-gray-500">Pilih file Excel atau CSV</p>

          <p className="text-sm text-gray-400 mt-1">
            Format: .xlsx, .xls, .csv (Max 10MB)
          </p>

          <input
            id="fileInput"
            type="file"
            hidden
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {file && (
            <p className="mt-4 text-green-600 font-medium">
              📄 {file.name}
            </p>
          )}
        </div>

        {/* BUTTON */}
        <button
          onClick={() => setShowModal(true)}
          disabled={!file}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:bg-gray-400"
        >
          Upload Data
        </button>
      </div>

      {/* ================= MODAL ================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px] text-center space-y-4">
            <div className="text-4xl">📤</div>

            <h2 className="text-lg font-semibold">
              Konfirmasi Upload
            </h2>

            <p>
              Anda akan mengupload data <b>{type}</b> untuk periode{" "}
              <b>
                {bulanList[bulan - 1]} {tahun}
              </b>
            </p>

            <div className="bg-gray-100 p-3 rounded text-sm">
              {file?.name}
            </div>

            <p className="text-sm text-gray-500">
              Apakah Anda yakin ingin melanjutkan?
            </p>

            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={handleUpload}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                {loading ? "Uploading..." : "Ya, Upload Sekarang"}
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="border px-4 py-2 rounded"
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