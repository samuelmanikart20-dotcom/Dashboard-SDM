"use client";

import { useState, useEffect } from "react";

interface StatsData {
  spmt: {
    daerahCount: number;
    periodeCount: number;
    totalRecords: number;
  };
  ptp: {
    daerahCount: number;
    periodeCount: number;
    totalRecords: number;
  };
  ikt: {
    daerahCount: number;
    periodeCount: number;
    totalRecords: number;
  };
  tcu: {
    daerahCount: number;
    periodeCount: number;
    totalRecords: number;
  };
}

export default function UserHomePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch dari API stats summary yang lebih akurat
      const response = await fetch("/api/admin/stats-summary");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      
      const result = await response.json();

      if (result.success && result.data) {
        setStats(result.data);
      } else {
        // Fallback ke API lama jika API baru gagal
        const [spmtDaerah, spmtPeriods, ptpDaerah, ptpPeriods, tcuDaerah, tcuPeriods, iktPeriods] = await Promise.all([
          fetch("/api/admin/daerah").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
          fetch("/api/admin/available-months").then((r) => r.json()).catch(() => ({ periods: [] })),
          fetch("/api/admin/ptp-daerah").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
          fetch("/api/admin/ptp-available-months").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
          fetch("/api/admin/tcu-daerah").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
          fetch("/api/admin/tcu-available-months").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
          fetch("/api/admin/ikt-available-months").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        ]);

        setStats({
          spmt: {
            daerahCount: spmtDaerah?.success !== false ? (spmtDaerah?.data?.length || 0) : 0,
            periodeCount: spmtPeriods?.periods?.length || 0,
            totalRecords: 0,
          },
          ptp: {
            daerahCount: ptpDaerah?.success !== false ? (ptpDaerah?.data?.length || 0) : 0,
            periodeCount: ptpPeriods?.success !== false ? (ptpPeriods?.data?.length || 0) : 0,
            totalRecords: 0,
          },
          ikt: {
            daerahCount: 8,
            periodeCount: iktPeriods?.success !== false ? (iktPeriods?.data?.length || 0) : 0,
            totalRecords: 0,
          },
          tcu: {
            daerahCount: tcuDaerah?.success !== false ? (tcuDaerah?.data?.length || 0) : 0,
            periodeCount: tcuPeriods?.success !== false ? (tcuPeriods?.data?.length || 0) : 0,
            totalRecords: 0,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Set default values on error
      setStats({
        spmt: { daerahCount: 0, periodeCount: 0, totalRecords: 0 },
        ptp: { daerahCount: 0, periodeCount: 0, totalRecords: 0 },
        ikt: { daerahCount: 8, periodeCount: 0, totalRecords: 0 },
        tcu: { daerahCount: 0, periodeCount: 0, totalRecords: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Selamat Datang di SPMT Pelindo
        </h1>
        <p className="text-gray-600 text-lg">
          Sistem Pengelolaan Manajemen Data Karyawan
        </p>
      </div>

      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-8 mb-8">
        <div className="flex items-center mb-4">
          <div className="bg-blue-500 p-3 rounded-full mr-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-blue-800 mb-1">
              Dashboard User SPMT Pelindo
            </h3>
            <p className="text-blue-700">
              Akses data karyawan dan informasi divisi SPMT, PTP, IKT, dan TCU
              di seluruh Indonesia
            </p>
          </div>
        </div>
      </div>

     
      {/* Quick Navigation Cards - 4 Cards untuk SPMT, PTP, IKT, TCU */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* SPMT Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-3 rounded-lg mr-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">
                Data SPMT
              </h4>
              <p className="text-sm text-gray-600">Data per daerah SPMT</p>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Akses data karyawan berdasarkan daerah operasional SPMT Pelindo di
            seluruh Indonesia dengan struktur organisasi.
          </p>
          <a
            href="/user/regional"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Lihat Data SPMT
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
        
        {/* PTP Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-3 rounded-lg mr-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Data PTP</h4>
              <p className="text-sm text-gray-600">Data per daerah PTP</p>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Akses data karyawan PTP (Pelabuhan Tanjung Priok) dengan informasi
            demografi dan statistik lengkap per unit kerja.
          </p>
          <a
            href="/user/ptp"
            className="inline-flex items-center text-green-600 hover:text-green-800 font-medium"
          >
            Lihat Data PTP
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>

        {/* IKT Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-yellow-100 p-3 rounded-lg mr-4">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Data IKT</h4>
              <p className="text-sm text-gray-600">Data per daerah IKT</p>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Akses data karyawan IKT (Indoonesia Kendaraann Terminal)
            dengan analisis demografi dan produktivitas.
          </p>
          <a
            href="/user/ikt"
            className="inline-flex items-center text-yellow-600 hover:text-yellow-800 font-medium"
          >
            Lihat Data IKT
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>

        {/* TCU Card */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-3 rounded-lg mr-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Data TCU</h4>
              <p className="text-sm text-gray-600">Data per daerah TCU</p>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Akses data karyawan TCU (Terminal Curah Utama) dengan informasi
            lengkap demografi dan statistik operasional.
          </p>
          <a
            href="/user/tcu"
            className="inline-flex items-center text-purple-600 hover:text-purple-800 font-medium"
          >
            Lihat Data TCU
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>



       {/* Statistics Section */}
       <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-6">
          Statistik Data
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Memuat statistik...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* SPMT Stats */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-800">SPMT</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jumlah Daerah</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {stats?.spmt.daerahCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Periode Tersedia</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {stats?.spmt.periodeCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Data</span>
                  <span className="text-xl font-bold text-blue-600">
                    {stats?.spmt.totalRecords?.toLocaleString('id-ID') || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* PTP Stats */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-500 p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-800">PTP</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jumlah Daerah</span>
                  <span className="text-2xl font-bold text-green-600">
                    {stats?.ptp.daerahCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Periode Tersedia</span>
                  <span className="text-2xl font-bold text-green-600">
                    {stats?.ptp.periodeCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Data</span>
                  <span className="text-xl font-bold text-green-600">
                    {stats?.ptp.totalRecords?.toLocaleString('id-ID') || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* IKT Stats */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-800">IKT</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jumlah Daerah</span>
                  <span className="text-2xl font-bold text-yellow-600">
                    {stats?.ikt.daerahCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Periode Tersedia</span>
                  <span className="text-2xl font-bold text-yellow-600">
                    {stats?.ikt.periodeCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Data</span>
                  <span className="text-xl font-bold text-yellow-600">
                    {stats?.ikt.totalRecords?.toLocaleString('id-ID') || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* TCU Stats */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-800">TCU</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jumlah Daerah</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {stats?.tcu.daerahCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Periode Tersedia</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {stats?.tcu.periodeCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Data</span>
                  <span className="text-xl font-bold text-purple-600">
                    {stats?.tcu.totalRecords?.toLocaleString('id-ID') || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Informasi Sistem
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800 mb-2">Data SPMT</h4>
            <p className="text-sm text-gray-600">
              Dashboard lengkap dengan statistik real-time dan grafik distribusi
            </p>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800 mb-2">Data PTP</h4>
            <p className="text-sm text-gray-600">
              Analisis demografi dan produktivitas per unit kerja PTP
            </p>
          </div>

          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="bg-yellow-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800 mb-2">Data IKT</h4>
            <p className="text-sm text-gray-600">
              Statistik karyawan IKT dengan filter periode dan daerah
            </p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="bg-purple-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-800 mb-2">Data TCU</h4>
            <p className="text-sm text-gray-600">
              Dashboard TCU dengan analisis operasional dan demografi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
