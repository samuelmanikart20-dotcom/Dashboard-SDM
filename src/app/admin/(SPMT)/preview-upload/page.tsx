'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FaSpinner, FaArrowLeft, FaFileExcel, FaFileCsv, FaDownload } from 'react-icons/fa';

export default function PreviewUploadPage() {
  const searchParams = useSearchParams();
  const [fileData, setFileData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fileName = searchParams.get('file') || '';
  const fileSize = searchParams.get('size') || '0';
  const fileType = fileName.endsWith('.csv') ? 'csv' : 'excel';

  useEffect(() => {
  const loadFileData = async () => {
    try {
      const fileParam = searchParams.get('file');
      const sizeParam = searchParams.get('size');
      
      if (!fileParam || !sizeParam) {
        throw new Error('File information is missing');
      }

      // Get the actual file from the server
      const response = await fetch(`/api/admin/get-uploaded-file?file=${encodeURIComponent(fileParam)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load file data');
      }

      const data = await response.json();
      
      // Assuming the API returns data in { headers: string[], rows: any[][] } format
      setFileData(data);
    } catch (err) {
  setError(err instanceof Error ? err.message : 'Gagal memuat data file');
    } finally {
      setLoading(false);
    }
  };

  loadFileData();
}, [searchParams]);

  const handleBack = () => {
    window.history.back();
  };

  const handleDownload = () => {
    // Fungsi untuk mendownload file
    const link = document.createElement('a');
    link.href = `/api/admin/download-file?file=${encodeURIComponent(fileName)}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <FaArrowLeft className="mr-2" /> Kembali ke Upload
        </button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pratinjau File</h1>
            <div className="flex items-center mt-2">
              {fileType === 'csv' ? (
                <FaFileCsv className="text-green-600 mr-2 text-2xl" />
              ) : (
                <FaFileExcel className="text-green-600 mr-2 text-2xl" />
              )}
              <div>
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-gray-500">
                  Ukuran: {(parseInt(fileSize) / 1024 / 1024).toFixed(2)} MB • {fileType.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap"
          >
            <FaDownload className="mr-2" />
            Download File
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FaSpinner className="animate-spin mx-auto h-8 w-8 text-blue-600" />
            <p className="mt-2 text-gray-600">Memuat pratinjau data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : fileData ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {fileData.headers.map((header, index) => (
                    <th 
                      key={index} 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fileData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex} 
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-gray-200 gap-2">
            <div className="text-sm text-gray-500">
              Menampilkan {fileData.rows.length} baris
            </div>
            <div className="text-sm text-gray-500">
              Total kolom: {fileData.headers.length}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}