"use client";

import { useState } from "react";
import {
  FaUpload,
  FaFileExcel,
  FaFileCsv,
  FaCheck,
  FaSpinner,
  FaDownload,
  FaTimes,
} from "react-icons/fa";

export default function UploadBOPOSPMTPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const valid = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (valid.includes(f.type) || f.name.endsWith(".csv")) {
      setSelectedFile(f);
      setError(null);
      setResult(null);
    } else {
      setSelectedFile(null);
      setError("Pilih file Excel (.xlsx/.xls) atau CSV");
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "KODE",
      "KETERANGAN",
      "BULAN",
      "TAHUN",
      "BOPO_RATIO",
      "PRODUKTIVITAS_EFISIENSI",
      "RASIO_BEBAN_PENGHASILAN_USAHA",
    ];

    // daftar kode
    const codes = [
      "KP", // Kantor Pusat
      "BBLW", // Belawan
      "BDMI", // Dumai
      "BTJI", // Tanjung Intan
      "BBHG", // Bumiharjo Bagendang
      "BTJW", // Tanjung Wangi
      "BMKS", // Makassar
      "BBLP", // Balikpapan
      "BJMR", // Jamrud Nilam Mirah
      "BTRI", // Trisakti
      "BPRE", // Pare-Pare
      "BTJE", // Tanjung Emas
      "BLMB", // Lembar
      "BGRS", // Gresik
      "BMLH", // Malahayati
      "BLHW", // Lhokseumawe
      "BNOA", // Benoa
      "BSBG", // Sibolga
      "BTBK", // Tanjung Balai Karimun
      "BTPI", // Tanjung Pinang
      "BBMB", // Bima Badas
    ];

    const KETERANGAN = [
      "Kantor Pusat",
      "Belawan",
      "Dumai",
      "Tanjung Intan",
      "Bumiharjo Bagendang",
      "Tanjung Wangi",
      "Makassar",
      "Balikpapan",
      "Jamrud Nilam Mirah",
      "Trisakti",
      "Pare-Pare",
      "Tanjung Emas",
      "Lembar",
      "Gresik",
      "Malahayati",
      "Lhokseumawe",
      "Benoa",
      "Sibolga",
      "Tanjung Balai Karimun",
      "Tanjung Pinang",
      "Bima Badas",
    ];

    const bulan = "8";
    const tahun = "2024";
    const BOPO_RATIO = 23;
    const PRODUKTIVITAS_EFISIENSI = 23;
    const RASIO_BEBAN_PENGHASILAN_USAHA = 23;

    const rows = codes.map((code, index) => {
      if (index === 0) {
        // baris pertama lengkap
        return [
          code,
          KETERANGAN[index],
          bulan,
          tahun,
          BOPO_RATIO,
          PRODUKTIVITAS_EFISIENSI,
          RASIO_BEBAN_PENGHASILAN_USAHA,
        ];
      } else {
        // baris lain hanya KODE
        return [code, KETERANGAN[index], "", "", "", "", ""];
      }
    });

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-bopo-spmt.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadClick = () => {
    if (!selectedFile) return;
    setShowConfirmModal(true);
  };

  const handleUpload = async () => {
    setShowConfirmModal(false);
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/admin/upload-bopo-spmt", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload gagal");
      setResult(json);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload BOPO SPMT</h1>
        <p className="text-gray-600">
          Unggah file Excel/CSV untuk memperbarui tabel BOPO SPMT
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Template BOPO</h3>
            <p className="text-blue-700">
              Header: KODE, BULAN, TAHUN, BOPO_RATIO, PRODUKTIVITAS_EFISIENSI,
              RASIO_BEBAN_PENGHASILAN_USAHA, KETERANGAN
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <FaDownload />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pilih File</h2>
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <FaFileExcel className="h-12 w-12 text-blue-500" />
              <FaFileCsv className="h-12 w-12 text-blue-500" />
            </div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-lg font-medium text-gray-700">
                Pilih file Excel atau CSV
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  File terpilih: {selectedFile.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUploadClick}
            disabled={!selectedFile || uploading}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Mengupload...</span>
              </>
            ) : (
              <>
                <FaUpload />
                <span>Upload BOPO</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedFile && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md pointer-events-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Konfirmasi Upload</h3>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={uploading}
              >
                <FaTimes />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center text-blue-500 mb-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <FaUpload className="w-6 h-6" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-gray-700 mb-2">
                  Anda akan mengupload data BOPO SPMT
                </p>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    Ukuran: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <p className="mt-4 text-gray-600">Apakah Anda yakin ingin melanjutkan?</p>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-center space-x-3">
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Mengupload...</span>
                  </>
                ) : (
                  <>
                    <FaUpload />
                    <span>Ya, Upload Sekarang</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={uploading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FaCheck className="text-blue-600" />
            <h3 className="text-lg font-medium text-blue-900">Upload Berhasil!</h3>
          </div>
          
          {/* Parse message untuk mendapatkan inserted dan updated */}
          {(() => {
            const message = result.message || "";
            const insertedMatch = message.match(/Ditambahkan:\s*(\d+)/);
            const updatedMatch = message.match(/Diperbarui:\s*(\d+)/);
            const inserted = insertedMatch ? parseInt(insertedMatch[1]) : 0;
            const updated = updatedMatch ? parseInt(updatedMatch[1]) : 0;
            const totalRecords = inserted + updated;

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {totalRecords || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {inserted || 0}
                    </div>
                    <div className="text-sm text-gray-600">Data Baru</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {updated || 0}
                    </div>
                    <div className="text-sm text-gray-600">Data Diupdate</div>
                  </div>
          </div>

                <div className="mt-4">
                  <p className="text-green-700">
                    Data BOPO berhasil diupload! Dashboard akan menampilkan data terbaru.
          </p>
                  <a 
                    href="/admin/regional" 
                    className="inline-block mt-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Lihat Dashboard SPMT →
                  </a>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
