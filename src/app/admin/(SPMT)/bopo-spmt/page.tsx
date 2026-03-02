'use client';

import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';

interface Daerah {
  id: number;
  nama: string;
  kode: string;
}

interface BopoData {
  id: number;
  daerah_id: number;
  daerah_nama: string;
  daerah_kode: string;
  bopo_ratio: number | null;
  produktivitas_efisiensi: number | null;
  rasio_beban_penghasilan_usaha: number | null;
  bulan: number;
  tahun: number;
  keterangan: string | null;
  created_at: string;
  updated_at: string;
}


const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const BopoSpmtPage: React.FC = () => {
  const [bopoData, setBopoData] = useState<BopoData[]>([]);
  const [daerahList, setDaerahList] = useState<Daerah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingData, setEditingData] = useState<BopoData | null>(null);
  const [filterDaerah, setFilterDaerah] = useState('');
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState('');

  const [formData, setFormData] = useState({
    daerah_id: '',
    bopo_ratio: '',
    produktivitas_efisiensi: '',
    rasio_beban_penghasilan_usaha: '',
    bulan: '',
    tahun: '',
    keterangan: ''
  });

  useEffect(() => {
    fetchDaerahList();
    fetchBopoData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDaerah, filterBulan, filterTahun]);

  const fetchDaerahList = async () => {
    try {
      const response = await fetch('/api/admin/daerah');
      const result = await response.json();
      if (result.success) {
        setDaerahList(result.data);
      }
    } catch (error) {
      console.error('Error fetching daerah list:', error);
    }
  };

  const fetchBopoData = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/bopo-spmt?';
      const params = new URLSearchParams();
      
      if (filterDaerah) params.append('daerah_id', filterDaerah);
      if (filterBulan) params.append('bulan', filterBulan);
      if (filterTahun) params.append('tahun', filterTahun);
      
      url += params.toString();
      
      console.log('Fetching BOPO data from:', url);
      const response = await fetch(url);
      const result = await response.json();
      console.log('BOPO API Response:', result);
      
      if (result.success) {
        console.log('Setting BOPO data:', result.data);
        setBopoData(result.data);
      } else {
        console.error('API returned error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching BOPO data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: {
      daerah_id: number;
      bopo_ratio: number | null;
      produktivitas_efisiensi: number | null;
      rasio_beban_penghasilan_usaha: number | null;
      bulan: number;
      tahun: number;
      keterangan: string | null;
      id?: number; 
    } = {
      daerah_id: parseInt(formData.daerah_id),
      bopo_ratio: formData.bopo_ratio ? parseFloat(formData.bopo_ratio) : null,
      produktivitas_efisiensi: formData.produktivitas_efisiensi ? parseFloat(formData.produktivitas_efisiensi) : null,
      rasio_beban_penghasilan_usaha: formData.rasio_beban_penghasilan_usaha ? parseFloat(formData.rasio_beban_penghasilan_usaha) : null,
      bulan: parseInt(formData.bulan),
      tahun: parseInt(formData.tahun),
      keterangan: formData.keterangan || null
    };

    if (editingData) {
      payload.id = editingData.id;
    }

    try {
      const url = editingData ? '/api/admin/bopo-spmt' : '/api/admin/bopo-spmt';
      const method = editingData ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(editingData ? 'Data berhasil diperbarui!' : 'Data berhasil ditambahkan!');
        resetForm();
        fetchBopoData();
      } else {
        alert(result.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error saving BOPO data:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    }
  };

  const handleEdit = (data: BopoData) => {
    setEditingData(data);
    setFormData({
      daerah_id: data.daerah_id.toString(),
      bopo_ratio: data.bopo_ratio?.toString() || '',
      produktivitas_efisiensi: data.produktivitas_efisiensi?.toString() || '',
      rasio_beban_penghasilan_usaha: data.rasio_beban_penghasilan_usaha?.toString() || '',
      bulan: data.bulan.toString(),
      tahun: data.tahun.toString(),
      keterangan: data.keterangan || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/bopo-spmt?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Data berhasil dihapus!');
        fetchBopoData();
      } else {
        alert(result.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error deleting BOPO data:', error);
      alert('Terjadi kesalahan saat menghapus data');
    }
  };

  const resetForm = () => {
    setFormData({
      daerah_id: '',
      bopo_ratio: '',
      produktivitas_efisiensi: '',
      rasio_beban_penghasilan_usaha: '',
      bulan: '',
      tahun: '',
      keterangan: ''
    });
    setEditingData(null);
    setShowForm(false);
  };

  const formatNumber = (value: number | string | null, removeTrailingZeros: boolean = false) => {
    if (value === null || value === undefined || value === '') return '-';
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if conversion resulted in a valid number
    if (isNaN(numValue)) return '-';
    
    // Remove trailing zeros by converting to number and back to string
    // This handles cases like 5.0000 -> 5, 5.5000 -> 5.5, etc.
    let formattedValue = parseFloat(numValue.toString());
    
    if (removeTrailingZeros) {
      formattedValue = parseFloat(formattedValue.toFixed(4));
    }
    
    // Format large numbers with commas for thousands separator
    if (Math.abs(formattedValue) >= 1000) {
      return formattedValue.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
        useGrouping: true
      });
    }
    
    // For smaller numbers, just return without trailing zeros
    return formattedValue.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data BOPO SPMT</h1>
          <p className="text-gray-600">Manajemen data BOPO, Produktivitas, dan Rasio Beban Penghasilan untuk SPMT</p>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daerah</label>
              <select
                value={filterDaerah}
                onChange={(e) => setFilterDaerah(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Semua Daerah</option>
                {daerahList.map((daerah) => (
                  <option key={daerah.id} value={daerah.id}>
                    {daerah.nama} ({daerah.kode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bulan</label>
              <select
                value={filterBulan}
                onChange={(e) => setFilterBulan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Semua Bulan</option>
                {monthNames.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tahun</label>
              <select
                value={filterTahun}
                onChange={(e) => setFilterTahun(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Semua Tahun</option>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <FaPlus className="mr-2" />
                Tambah Data
              </button>
            </div>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingData ? 'Edit Data BOPO' : 'Tambah Data BOPO'}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FaTimes size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Daerah *</label>
                      <select
                        name="daerah_id"
                        value={formData.daerah_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="">Pilih Daerah</option>
                        {daerahList.map((daerah) => (
                          <option key={daerah.id} value={daerah.id}>
                            {daerah.nama} ({daerah.kode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bulan *</label>
                      <select
                        name="bulan"
                        value={formData.bulan}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="">Pilih Bulan</option>
                        {monthNames.map((name, index) => (
                          <option key={index + 1} value={index + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tahun *</label>
                      <select
                        name="tahun"
                        value={formData.tahun}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="">Pilih Tahun</option>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 5 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Main Data Fields */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Utama</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rasio BOPO</label>
                        <input
                          type="text"
                          name="bopo_ratio"
                          value={formatNumber(formData.bopo_ratio, true)}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Efisiensi Produktivitas</label>
                        <input
                          type="text"
                          name="produktivitas_efisiensi"
                          value={formData.produktivitas_efisiensi}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                          placeholder="0"
                          pattern="[0-9]*\.?[0-9]*"
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rasio Beban Penghasilan/Usaha</label>
                        <input
                          type="text"
                          name="rasio_beban_penghasilan_usaha"
                          value={formatNumber(formData.rasio_beban_penghasilan_usaha, true)}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                          placeholder="0"
                          pattern="[0-9]*\.?[0-9]*"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div className="border-t pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Keterangan</label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      rows={3}
                      placeholder="Tambahkan keterangan jika diperlukan..."
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <FaSave className="mr-2" />
                      {editingData ? 'Update' : 'Simpan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Data BOPO SPMT</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Memuat data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daerah</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rasio BOPO</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efisiensi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rasio Beban</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bopoData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          Tidak ada data BOPO yang tersedia
                        </td>
                      </tr>
                    ) : (
                      bopoData.map((data) => (
                        <tr key={data.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{data.daerah_nama}</div>
                            <div className="text-sm text-gray-500">{data.daerah_kode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{monthNames[data.bulan - 1]} {data.tahun}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {data.bopo_ratio !== null ? formatNumber(data.bopo_ratio) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {data.produktivitas_efisiensi !== null ? formatNumber(data.produktivitas_efisiensi) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {data.rasio_beban_penghasilan_usaha !== null ? formatNumber(data.rasio_beban_penghasilan_usaha) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleEdit(data)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDelete(data.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BopoSpmtPage;
