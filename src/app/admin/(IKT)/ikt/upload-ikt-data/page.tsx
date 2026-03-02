'use client';

import { useState } from 'react';
import { FaUpload, FaFileExcel, FaFileCsv, FaCheck, FaSpinner, FaDownload, FaCalendarAlt } from 'react-icons/fa';

export default function UploadIKTDataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please select a valid Excel (.xlsx, .xls) or CSV file');
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Validate month and year
    if (!selectedMonth || !selectedYear) {
      setError('Silakan pilih bulan dan tahun');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('bulan', selectedMonth.toString());
      formData.append('tahun', selectedYear.toString());

      const response = await fetch('/api/admin/upload-ikt-data', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
      } else {
        setError(result.message || 'Upload failed');
      }
    } catch {
      setError('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a sample CSV template for IKT
    const headers = [
      'NPP', 'NAMA', 'TANGGAL LAHIR', 'NAMA JABATAN', 'ENTITAS', 'UNIT KERJA',
      'KATEGORI', 'JENIS KELAMIN', 'JENIS PEKERJA (ORGANIK/NON ORGANIK)', 
      'PUSAT PELAYANAN OPERASIONAL/NON OPERASIONAL', 'NON OPERASIONAL', 'STATUS LAPORAN RAKOMDIR'
    ];
    
    const sampleData = [
      ['IKT001', 'Ahmad Sutrisno', '23-May-1980', 'General Manager IKT', 'IKT Kantor Pusat', 'IKT-KP', 'Tetap', 'Laki-laki', 'Organik', 'Operasional', '', 'Aktif'],
      ['IKT002', 'Sari Indrawati', '15/8/1985', 'Deputy GM IKT', 'IKT Jakarta', 'IKT-JKT', 'Tetap', 'Perempuan', 'Non Organik', 'Non Operasional', 'Support', 'Aktif'],
      ['IKT003', 'Budi Santoso', '1-3-1972', 'IT Manager', 'IKT Jakarta', 'IKT-JKT', 'Kontrak', 'Laki-laki', 'Organik', 'Operasional', '', 'Aktif']
    ];

    const csvContent = [
      headers.join(';'),
      ...sampleData.map(row => row.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-ikt-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Data IKT</h1>
        <p className="text-gray-600">Upload file Excel atau CSV untuk mengupdate data dashboard IKT</p>
      </div>

      {/* Template Download */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Download Template</h3>
            <p className="text-blue-700">Download template CSV untuk format data IKT yang benar</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <FaDownload />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload File</h2>
        
        {/* Month and Year Selection */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <FaCalendarAlt className="text-blue-600" />
            <h3 className="text-md font-medium text-gray-800">Pilih Periode Data</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-2">
                Bulan
              </label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              >
                <option value={1}>Januari</option>
                <option value={2}>Februari</option>
                <option value={3}>Maret</option>
                <option value={4}>April</option>
                <option value={5}>Mei</option>
                <option value={6}>Juni</option>
                <option value={7}>Juli</option>
                <option value={8}>Agustus</option>
                <option value={9}>September</option>
                <option value={10}>Oktober</option>
                <option value={11}>November</option>
                <option value={12}>Desember</option>
              </select>
            </div>
            <div>
              <label htmlFor="year-input" className="block text-sm font-medium text-gray-700 mb-2">
                Tahun
              </label>
              <input
                id="year-input"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                placeholder="Contoh: 2024"
                min="2000"
                max="2100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Data yang diupload akan ditandai dengan periode: {selectedMonth}/{selectedYear}
          </p>
        </div>
        
        {/* File Input */}
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <FaFileExcel className="h-12 w-12 text-blue-500" />
              <FaFileCsv className="h-12 w-12 text-blue-500" />
            </div>
            
            <div>
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-lg font-medium text-gray-700">
                  Pilih file Excel atau CSV untuk data IKT
                </span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">
                Format yang didukung: .xlsx, .xls, .csv (Max 10MB)
              </p>
            </div>

            {selectedFile && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  File terpilih: {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  Ukuran: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Upload Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Mengupload...</span>
              </>
            ) : (
              <>
                <FaUpload />
                <span>Upload Data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FaCheck className="text-blue-600" />
            <h3 className="text-lg font-medium text-blue-900">Upload Berhasil!</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {uploadResult.recordsProcessed || 0}
              </div>
              <div className="text-sm text-gray-600">Records Diproses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {uploadResult.recordsInserted || 0}
              </div>
              <div className="text-sm text-gray-600">Data Tersimpan</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {uploadResult.recordsReplaced || 0}
              </div>
              <div className="text-sm text-gray-600">Data Diganti</div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-blue-700">
              {uploadResult.message || 'Data IKT berhasil diupload! Dashboard akan menampilkan data terbaru.'}
            </p>
            <a 
              href="/admin/ikt" 
              className="inline-block mt-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              Lihat Dashboard IKT →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
