"use client";

import { useState } from "react";
import ExcelOrgChart from "./ExcelOrgChart";

export default function StrukturOrganisasiPage() {
  const currentDate = new Date();
  const [selectedBulan, setSelectedBulan] = useState<number>(currentDate.getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState<number>(currentDate.getFullYear());

  // Callback untuk dipanggil setelah upload berhasil
  const handleUploadSuccess = () => {
    // Upload berhasil, tidak perlu fetch data lagi karena sudah ada halaman terpisah untuk melihat
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Upload Struktur Organisasi SPMT
        </h1>
      </div>

      {/* Upload Section */}
      <ExcelOrgChart
        selectedBulan={selectedBulan}
        selectedTahun={selectedTahun}
        divisi="SPMT"
        onUploadSuccess={handleUploadSuccess}
        onPeriodChange={(bulan, tahun) => {
          setSelectedBulan(bulan);
          setSelectedTahun(tahun);
        }}
      />
    </div>
  );
}
