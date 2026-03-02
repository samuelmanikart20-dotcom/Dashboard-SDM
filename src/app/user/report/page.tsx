// src/app/user/report/page.tsx
'use client';

// import { useState } from 'react';
//import { exportMultipleChartsToPdf } from '@/utils/exportUtils';
//import ChartExport from '@/components/ChartExport/ChartExport';
import { ChartData } from 'chart.js';

export default function ReportPage() {
  // Data untuk pie chart sederhana
  const genderData: ChartData<'pie'> = {
    labels: ['Laki-laki', 'Perempuan'],
    datasets: [
      {
        data: [65, 35],
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Data untuk donat chart
  const educationData: ChartData<'doughnut'> = {
    labels: ['S3', 'S2', 'S1', 'D3', 'SMA/SMK'],
    datasets: [
      {
        data: [5, 15, 30, 10, 40],
        backgroundColor: [
          'rgba(78, 115, 223, 0.8)',
          'rgba(28, 200, 138, 0.8)',
          'rgba(54, 185, 204, 0.8)',
          'rgba(246, 194, 62, 0.8)',
          'rgba(231, 74, 59, 0.8)',
        ],
        borderColor: [
          'rgba(78, 115, 223, 1)',
          'rgba(28, 200, 138, 1)',
          'rgba(54, 185, 204, 1)',
          'rgba(246, 194, 62, 1)',
          'rgba(231, 74, 59, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Data untuk pie chart dengan banyak kategori
  const departmentData: ChartData<'pie'> = {
    labels: ['IT', 'HRD', 'Keuangan', 'Operasional', 'Pemasaran', 'Lainnya'],
    datasets: [
      {
        data: [25, 15, 20, 30, 5, 5],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Data untuk donat chart dengan hole yang lebih besar
  const statusData: ChartData<'doughnut'> = {
    labels: ['Tetap', 'Kontrak', 'Magang', 'Outsourcing'],
    datasets: [
      {
        data: [50, 30, 10, 10],
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // const handleExport = async () => {
  //   const chartIds = ['genderChart', 'educationChart', 'departmentChart', 'statusChart'];
  //   const success = await exportMultipleChartsToPdf(chartIds, 'Laporan_Statistik_Karyawan');
  //   
  //   if (success) {
  //     alert('Berhasil mengekspor laporan ke PDF');
  //   } else {
  //     alert('Gagal mengekspor laporan. Silakan coba lagi.');
  //   }
  // };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Laporan Statistik Karyawan</h1>
            <p className="mt-2 text-sm text-gray-600">
              Data terbaru per {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          {/* <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Ekspor ke PDF
          </button> */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart Sederhana */}
          {/* <ChartExport
            type="pie"
            data={genderData}
            title="Distribusi Gender Karyawan"
            chartId="genderChart"
            showValues={true}
            showPercentages={true}
            legendPosition="right"
          /> */}

          {/* Donut Chart */}
          {/* <ChartExport
            type="doughnut"
            data={educationData}
            title="Tingkat Pendidikan Karyawan"
            chartId="educationChart"
            showValues={false}
            showPercentages={true}
            cutoutPercentage={60}
          /> */}

          {/* Pie Chart dengan Banyak Kategori */}
          {/* <ChartExport
            type="pie"
            data={departmentData}
            title="Distribusi Departemen"
            chartId="departmentChart"
            showValues={true}
            showPercentages={true}
            legendPosition="right"
          /> */}

          {/* Donut Chart dengan Hole Lebih Besar */}
          {/* <ChartExport
            type="doughnut"
            data={statusData}
            title="Status Karyawan"
            chartId="statusChart"
            showValues={true}
            showPercentages={true}
            cutoutPercentage={70}
            legendPosition="bottom"
          /> */}
          <div className="text-center py-8 text-gray-500">
            Halaman laporan sedang dalam pengembangan
          </div>
        </div>
      </div>
    </div>
  );
}