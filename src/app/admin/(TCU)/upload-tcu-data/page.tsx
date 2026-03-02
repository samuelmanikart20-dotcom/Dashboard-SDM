'use client';

import { useState } from 'react';
import { FaUpload, FaFileExcel, FaFileCsv, FaCheck, FaSpinner, FaDownload, FaCalendarAlt, FaTimes } from 'react-icons/fa';

export default function UploadTCUDataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);

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

  const handleUploadClick = () => {
    if (!selectedFile) return;

    // Validate month and year
    if (!selectedMonth || !selectedYear) {
      setError('Silakan pilih bulan dan tahun');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleUpload = async () => {
    setShowConfirmModal(false);
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('bulan', selectedMonth.toString());
      formData.append('tahun', selectedYear.toString());

      const response = await fetch('/api/admin/upload-tcu-data', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        // Show error modal if there are errors
        if (result.errors > 0 && result.errorDetails && result.errorDetails.length > 0) {
          setShowErrorModal(true);
        }
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
    // Create a sample CSV template for TCU
    const headers = [
      'NPP', 'NAMA', 'TANGGAL LAHIR', 'NAMA JABATAN', 'ENTITAS', 'UNIT KERJA',
      'KATEGORI', 'JENIS KELAMIN', 'JENIS PEKERJA (ORGANIK/NON ORGANIK)', 
      'PUSAT PELAYANAN OPERASIONAL/NON OPERASIONAL', 'NON OPERASIONAL', 'STATUS LAPORAN RAKOMDIR'
    ];
    
    const sampleData = [
      ['TCU001', 'Rudi Hermawan', '23-May-1980', 'Terminal Manager TCU', 'TCU Kantor Pusat', 'TCU-KP', 'Tetap', 'Laki-laki', 'Organik', 'Operasional', '', 'Aktif'],
      ['TCU002', 'Dewi Lestari', '15/8/1985', 'Operations Supervisor', 'TCU Jakarta', 'TCU-JKT', 'Tetap', 'Perempuan', 'Non Organik', 'Non Operasional', 'Support', 'Aktif'],
      ['TCU003', 'Agus Wijaya', '1-3-1972', 'Equipment Operator', 'TCU Jakarta', 'TCU-JKT', 'Kontrak', 'Laki-laki', 'Organik', 'Operasional', '', 'Aktif']
    ];

    const csvContent = [
      headers.join(';'),
      ...sampleData.map(row => row.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-tcu-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Data TCU</h1>
        <p className="text-gray-600">Upload file Excel atau CSV untuk mengupdate data dashboard TCU</p>
      </div>

      {/* Template Download */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Download Template</h3>
            <p className="text-blue-700">Download template CSV untuk format data TCU yang benar</p>
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
            onClick={handleUploadClick}
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
                  Anda akan mengupload data TCU untuk periode <span className="font-semibold">{selectedMonth}/{selectedYear}</span>
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

      {/* Upload Result */}
      {uploadResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FaCheck className="text-blue-600" />
            <h3 className="text-lg font-medium text-blue-900">Upload Berhasil!</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {uploadResult.totalRecords || uploadResult.recordsProcessed || 0}
              </div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {uploadResult.inserted || uploadResult.recordsInserted || 0}
              </div>
              <div className="text-sm text-gray-600">Data Baru</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {uploadResult.updated || uploadResult.recordsReplaced || 0}
              </div>
              <div className="text-sm text-gray-600">Data Diupdate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {uploadResult.errors || 0}
              </div>
              <div className="text-sm text-gray-600">Error</div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-green-700">
              Data berhasil diupload! Dashboard akan menampilkan data terbaru.
            </p>
            {uploadResult.errors > 0 && (
              <button
                onClick={() => setShowErrorModal(true)}
                className="mt-2 text-red-600 hover:text-red-800 font-medium underline"
              >
                Lihat Detail Error ({uploadResult.errors} error) →
              </button>
            )}
            <a 
              href="/admin/tcu" 
              className="inline-block mt-2 ml-4 text-blue-600 hover:text-blue-800 font-medium"
            >
              Lihat Dashboard TCU →
            </a>
          </div>
        </div>
      )}

      {/* Error Details Modal */}
      {showErrorModal && uploadResult?.errorDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-red-50">
              <div>
                <h3 className="text-lg font-semibold text-red-900">
                  Detail Error ({uploadResult.errors} error)
                </h3>
                <p className="text-sm text-red-700">
                  Data berikut tidak dapat diupload. Silakan perbaiki dan upload ulang.
                </p>
              </div>
              <button 
                onClick={() => setShowErrorModal(false)}
                className="text-red-400 hover:text-red-600"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {uploadResult.errorDetails.map((errorDetail: any, index: number) => (
                  <div 
                    key={index}
                    className="border border-red-200 rounded-lg p-4 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">
                        {errorDetail.row || index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-red-900">
                            Baris {errorDetail.row || index + 1}
                          </span>
                          {errorDetail.column && (
                            <>
                              <span className="text-red-600">•</span>
                              <span className="text-red-800 font-medium">
                                Kolom: {errorDetail.column}
                              </span>
                            </>
                          )}
                        </div>
                        {errorDetail.value && (
                          <div className="mb-2">
                            <span className="text-sm text-gray-600">Nilai: </span>
                            <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-red-200 text-red-900">
                              {errorDetail.value.length > 100 
                                ? `${errorDetail.value.substring(0, 100)}...` 
                                : errorDetail.value}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-sm text-gray-600">Alasan: </span>
                          <span className="text-sm text-red-800">
                            {errorDetail.reason || 'Tidak diketahui'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
