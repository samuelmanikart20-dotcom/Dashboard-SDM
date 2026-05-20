"use client";

import { useState, useEffect, useRef } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import Link from "next/link";
import SummaryCards from "@/components/SummaryCards";
import EntityFilter from "@/components/EntityFilter";
import EntityTable from "@/components/EntityTable";
import MutasiTable from "@/components/MutasiTable";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface TableData {
  npp: string;
  nama: string;
  tanggal_lahir: string;
  jabatan: string;
  entitas: string;
  unit_kerja: string;
  kategori: string;
  jenis_kelamin: string;
  organik_non_organik: string;
  pusat_pelayanan: string;
  non_operasional: string;
  pendidikan?: string;
  bulan: number;
  tahun: number;
}

interface ChartData {
  organik: number;
  nonOrganik: number;
  operasional: number;
  nonOperasional: number;
  lakiLaki: number;
  perempuan: number;
  organikOperasional: number;
  organikNonOperasional: number;
  nonOrganikOperasional: number;
  nonOrganikNonOperasional: number;
  total: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface DashboardStats {
  totalEmployees: number;
  tableData: TableData[];
  chartData: ChartData;
  pagination?: PaginationInfo;
}

interface BopoData {
  bopo_ratio: number | null;
  produktivitas_efisiensi: number | null;
  rasio_beban_penghasilan_usaha: number | null;
  month: string | null;
  year: string | null;
}

interface SDMOperasionalData {
  spmt: { operasional: number; nonOperasional: number; total: number };
  ptp: { operasional: number; nonOperasional: number; total: number };
  ikt: { operasional: number; nonOperasional: number; total: number };
  tcu: { operasional: number; nonOperasional: number; total: number };
}

interface RekapSDMData {
  status: string;
  satuan: string;
  realisasiTahunLalu: number;
  revisiRKAP: number | null;
  realisasiBulanSebelumnya: number;
  realisasiBulanIni: number;
  capaianYoY: number | null;
  capaianFY: number | null;
}

interface RekapSDMEntitasRow {
  status: string;
  satuan: string;
  rkap: number | null;
  realisasi: number;
  selisih: number | null;
  capaian: number | null;
}

interface RekapSDMEntitasData {
  spmt: RekapSDMEntitasRow[];
  ptp: RekapSDMEntitasRow[];
  ikt: RekapSDMEntitasRow[];
  tcu: RekapSDMEntitasRow[];
}

interface Period {
  bulan: number | "all";
  tahun: number;
  bulanName: string;
  totalRecords: number;
  label: string;
  value: string;
  type: "month" | "consolidation";
}

export default function AdminDashboard() {
  const [, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(100);
  const [, setBopo] = useState<BopoData | null>(null);
  const [, setFullTableData] = useState<TableData[]>([]);
  const [role] = useState<string>("user");
  const [sdmOperasional, setSdmOperasional] = useState<SDMOperasionalData | null>(null);
  const [rekapSDM, setRekapSDM] = useState<RekapSDMData[]>([]);
  const [loadingRekap, setLoadingRekap] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [editingRKAP, setEditingRKAP] = useState<{ [key: string]: string }>({});
  const [savingRKAP, setSavingRKAP] = useState<boolean>(false);

  const [activeEntitasTab, setActiveEntitasTab] = useState<"spmt" | "ptp" | "ikt" | "tcu">("spmt");
  const [rekapSDMEntitas, setRekapSDMEntitas] = useState<RekapSDMEntitasData | null>(null);
  const [loadingRekapEntitas, setLoadingRekapEntitas] = useState<boolean>(false);

  const [mutasiData, setMutasiData] = useState<any[]>([]);

  useEffect(() => {
    fetchAvailablePeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMutasi = async () => {
    if (!selectedPeriod) return;

    const [monthPart, yearPart] = selectedPeriod.split("-");
    const selectedMonth = monthPart === "all" ? "" : monthPart;
    const selectedYear = yearPart;

    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.append("bulan", selectedMonth);
      if (selectedYear) params.append("tahun", selectedYear);

      const response = await fetch(`/api/admin/mutasi-sdm?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setMutasiData(result.data);
      }
    } catch (error) {
      console.error("Error fetching mutasi data:", error);
      setMutasiData([]);
    }
  };

  useEffect(() => {
    if (selectedPeriod) {
      fetchMutasi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchSDMOperasionalStats = async (month?: string | null, year?: string) => {
    try {
      const params = new URLSearchParams();
      if (month) params.append("bulan", month);
      if (year) params.append("tahun", year);
      const response = await fetch(`/api/admin/sdm-operasional-stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) setSdmOperasional(data.data);
      }
    } catch (error) {
      console.error("Error fetching SDM operasional stats:", error);
    }
  };

  const fetchRekapSDM = async (month?: string | null, year?: string) => {
    if (!month || !year) { setRekapSDM([]); return; }
    setLoadingRekap(true);
    try {
      const params = new URLSearchParams();
      params.append("bulan", month);
      params.append("tahun", year);
      const response = await fetch(`/api/admin/rekap-sdm?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) setRekapSDM(data.data || []);
        else { console.error("[fetchRekapSDM] API returned success=false:", data); setRekapSDM([]); }
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error("[fetchRekapSDM] API error:", response.status, errorText);
        setRekapSDM([]);
      }
    } catch (error) {
      console.error("[fetchRekapSDM] Error fetching rekap SDM:", error);
      setRekapSDM([]);
    } finally {
      setLoadingRekap(false);
    }
  };

  const fetchRekapSDMEntitas = async (month?: string | null, year?: string) => {
    if (!month || !year) {
      setRekapSDMEntitas(null);
      return;
    }

    setLoadingRekapEntitas(true);

    try {
      const entities = ["SPMT", "PTP", "IKT", "TCU"];

      const results: any = {
        spmt: [],
        ptp: [],
        ikt: [],
        tcu: [],
      };

      for (const entity of entities) {
        const params = new URLSearchParams();
        params.append("bulan", month);
        params.append("tahun", year);
        params.append("entitas", entity);

        const response = await fetch(`/api/admin/rekap-sdm-entitas?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            results[entity.toLowerCase()] = data.data || [];
          }
        }
      }

      setRekapSDMEntitas(results);
    } catch (error) {
      console.error("[fetchRekapSDMEntitas] Error:", error);
      setRekapSDMEntitas(null);
    } finally {
      setLoadingRekapEntitas(false);
    }
  };

  const handleRKAPEdit = (status: string, currentValue: number | null) => {
    setEditingRKAP({ ...editingRKAP, [status]: (currentValue ?? 0).toString() });
  };

  const handleRKAPSave = async (status: string) => {
    if (!selectedPeriod) return;
    const bulan = parseInt(selectedPeriod.split("-")[0]);
    const tahun = parseInt(selectedPeriod.split("-")[1]);
    const nilaiStr = editingRKAP[status];
    if (!nilaiStr || nilaiStr.trim() === "") { setEditingRKAP({ ...editingRKAP, [status]: "" }); return; }
    const nilai = parseInt(nilaiStr);
    if (isNaN(nilai) || nilai < 0) { alert("Nilai harus berupa angka positif"); return; }
    setSavingRKAP(true);
    try {
      const getResponse = await fetch(`/api/admin/rkap-sdm?bulan=${bulan}&tahun=${tahun}`);
      const getData = await getResponse.json();
      const currentData = getData.success ? getData.data : {};
      const updatedData = { ...currentData, [status]: nilai };
      const saveResponse = await fetch("/api/admin/rkap-sdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulan, tahun, data: updatedData }),
      });
      const saveResult = await saveResponse.json();
      if (saveResult.success) {
        const newEditing = { ...editingRKAP };
        delete newEditing[status];
        setEditingRKAP(newEditing);
        await fetchRekapSDM(bulan.toString(), tahun.toString());
      } else {
        alert(saveResult.error || "Gagal menyimpan nilai RKAP");
      }
    } catch (error) {
      console.error("Error saving RKAP:", error);
      alert("Terjadi kesalahan saat menyimpan nilai RKAP");
    } finally {
      setSavingRKAP(false);
    }
  };

  const handleRKAPCancel = (status: string) => {
    const newEditing = { ...editingRKAP };
    delete newEditing[status];
    setEditingRKAP(newEditing);
  };

  useEffect(() => {
    if (selectedPeriod) {
      setCurrentPage(1);
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedPeriod) fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchAvailablePeriods = async () => {
    try {
      const response = await fetch("/api/admin/combined-available-months");
      const data = await response.json();
      if (data.periods && data.periods.length > 0) {
        setAvailablePeriods(data.periods);
        const firstPeriod = data.periods[0].value;
        setSelectedPeriod(firstPeriod);
        const [monthPart, yearPart] = firstPeriod.split("-");
        const month = monthPart === "all" ? null : monthPart;
        const year = yearPart;
        fetchSDMOperasionalStats(month, year);
        if (month) {
          fetchRekapSDM(month, year);
          fetchRekapSDMEntitas(month, year);
        }
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? null : monthPart;
      const year = yearPart;

      if (!year) { console.error("Invalid period format:", selectedPeriod); setLoading(false); return; }
      if (month) {
        const monthInt = parseInt(month);
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) { console.error("Invalid month value:", month); setLoading(false); return; }
      }

      fetchSDMOperasionalStats(month, year);

      if (month) {
        fetchRekapSDM(month, year);
        fetchRekapSDMEntitas(month, year);
      } else {
        setRekapSDM([]);
        setRekapSDMEntitas(null);
      }

      try {
        const bigParams = new URLSearchParams();
        if (month) bigParams.append("month", month);
        bigParams.append("year", year);
        bigParams.append("page", "1");
        bigParams.append("limit", "10000");
        const bigResp = await fetch(`/api/admin/combined-table-data?${bigParams.toString()}`);
        if (bigResp.ok) {
          const bigJson = await bigResp.json();
          setFullTableData(bigJson.data || []);
        } else { setFullTableData([]); }
      } catch (err) { console.error("Error fetching big table data:", err); setFullTableData([]); }

      const tableParams = new URLSearchParams();
      if (month) tableParams.append("month", month);
      tableParams.append("year", year);
      tableParams.append("page", currentPage.toString());
      tableParams.append("limit", itemsPerPage.toString());

      const statsParams = new URLSearchParams();
      if (month) statsParams.append("month", month);
      statsParams.append("year", year);

      let bopoData: BopoData | null = null;
      if (month) {
        try {
          const bopoResp = await fetch(`/api/admin/combined-bopo-dashboard?${statsParams.toString()}`);
          if (bopoResp.ok) {
            const bopoJson = await bopoResp.json();
            if (bopoJson?.success) bopoData = bopoJson.data as BopoData;
          }
        } catch (err) { console.error("Error fetching BOPO data:", err); bopoData = null; }
      }

      const tableResp = await fetch(`/api/admin/combined-table-data?${tableParams.toString()}`);
      const tableJson = await tableResp.json();
      const statsResp = await fetch(`/api/admin/combined-dashboard-stats?${statsParams.toString()}`);
      const statsJson = await statsResp.json();

      if (tableJson.success && statsJson.success) {
        setStats({
          totalEmployees: statsJson.data.totalEmployees ?? statsJson.data.chartData?.total ?? 0,
          tableData: tableJson.data || [],
          chartData: statsJson.data.chartData,
          pagination: tableJson.pagination,
        });
        setBopo(bopoData);
      } else {
        console.error("Failed to fetch combined data", { tableJson, statsJson });
        setStats({ totalEmployees: 0, tableData: [], chartData: defaultChartData });
        setBopo(null);
      }
    } catch (error) {
      console.error("Error fetching combined dashboard data:", error);
      setStats({ totalEmployees: 0, tableData: [], chartData: defaultChartData });
      setBopo(null);
    } finally {
      setLoading(false);
    }
  };

  const defaultChartData = {
    organik: 0, nonOrganik: 0, operasional: 0, nonOperasional: 0,
    lakiLaki: 0, perempuan: 0, organikOperasional: 0, organikNonOperasional: 0,
    nonOrganikOperasional: 0, nonOrganikNonOperasional: 0, total: 0,
  };

  const refreshData = () => {
    fetchDashboardData();
    fetchSDMOperasionalStats();
  };

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(event.target.value);
  };

  const handleExportPDF = () => {
    if (!dashboardRef.current) { alert("Tidak ada data untuk diekspor"); return; }
    try {
      setExportingPDF(true);
      setTimeout(() => {
        const canvases = dashboardRef.current?.querySelectorAll("canvas");
        if (canvases && canvases.length > 0) {
          canvases.forEach((canvas) => {
            try {
              const chartInstance = ChartJS.getChart(canvas as HTMLCanvasElement);
              if (chartInstance) { chartInstance.update("none"); chartInstance.resize(); chartInstance.update("none"); }
            } catch (e) { console.warn("Chart update warning:", e); }
          });
        }
        const allElements = dashboardRef.current?.querySelectorAll('table, canvas, div[class*="bg-white"], div[class*="h-32"]');
        if (allElements) {
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.display = ""; htmlEl.style.visibility = ""; htmlEl.style.opacity = "";
            if (el.tagName === "CANVAS") {
              const canvasEl = el as HTMLCanvasElement;
              if (canvasEl.width === 0 || canvasEl.height === 0) { canvasEl.width = canvasEl.offsetWidth || 300; canvasEl.height = canvasEl.offsetHeight || 128; }
            }
          });
        }
        const allCanvases = dashboardRef.current?.querySelectorAll("canvas");
        if (allCanvases) {
          allCanvases.forEach((canvas) => {
            const canvasEl = canvas as HTMLCanvasElement;
            canvasEl.style.display = "block"; canvasEl.style.visibility = "visible"; canvasEl.style.opacity = "1";
            canvasEl.style.width = "100%"; canvasEl.style.height = "128px"; canvasEl.style.minHeight = "128px";
            if (canvasEl.width === 0 || canvasEl.height === 0) {
              const parent = canvasEl.parentElement;
              if (parent) { canvasEl.width = parent.clientWidth || 300; canvasEl.height = 128; }
            }
            const chartInstance = ChartJS.getChart(canvasEl);
            if (chartInstance) { chartInstance.update("none"); chartInstance.resize(); }
          });
        }
        setTimeout(() => {
          window.print();
          setExportingPDF(false);
        }, 2000);
      }, 500);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Gagal mengekspor ke PDF. Silakan coba lagi.");
      setExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const ENTITAS_TABS: { key: "spmt" | "ptp" | "ikt" | "tcu"; label: string }[] = [
    { key: "spmt", label: "SPMT" },
    { key: "ptp", label: "PTP" },
    { key: "ikt", label: "IKT" },
    { key: "tcu", label: "TCU" },
  ];

  const getSelisihColor = (val: number | null) => {
    if (val === null) return "text-gray-600";
    if (val < 0) return "text-red-600 font-semibold";
    if (val > 0) return "text-green-600 font-semibold";
    return "text-gray-600";
  };

  const getCapaianColor = (val: number | null) => {
    if (val === null) return "text-gray-600";
    if (val >= 100) return "text-green-600 font-semibold";
    if (val >= 90) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const bulanNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const bulanNamesUpper = bulanNames.map((b) => b.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-100 dashboard-container" ref={dashboardRef}>
      {/* Blue Header */}
      <div className="bg-gradient-to-r text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">DEMOGRAFI SDM</h1>
              <p className="text-lg">PT PELINDO MULTI TERMINAL GRUP</p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Period selector */}
              <div className="bg-blue-500 px-4 py-2 rounded">
                <select
                  className="bg-transparent text-white border-none outline-none"
                  value={selectedPeriod}
                  onChange={handlePeriodChange}
                >
                  {(() => {
                    const periodsByYear = new Map<number, Period[]>();
                    availablePeriods.forEach((period) => {
                      const year = period.tahun;
                      if (!periodsByYear.has(year)) periodsByYear.set(year, []);
                      periodsByYear.get(year)!.push(period);
                    });
                    const sortedYears = Array.from(periodsByYear.keys()).sort((a, b) => b - a);
                    return sortedYears.map((year) => {
                      const yearPeriods = periodsByYear.get(year)!;
                      const consolidationPeriod = yearPeriods.find((p) => p.type === "consolidation");
                      const monthPeriods = yearPeriods
                        .filter((p) => p.type === "month")
                        .sort((a, b) => {
                          const bulanA = typeof a.bulan === "number" ? a.bulan : 0;
                          const bulanB = typeof b.bulan === "number" ? b.bulan : 0;
                          return bulanB - bulanA;
                        });
                      return (
                        <optgroup key={year} label={`Total Data ${year}`} className="font-bold">
                          {consolidationPeriod && (
                            <option key={consolidationPeriod.value} className="text-black font-bold" value={consolidationPeriod.value}>
                              {consolidationPeriod.label}
                            </option>
                          )}
                          {monthPeriods.map((period) => (
                            <option key={period.value} className="text-black" value={period.value}>
                              {period.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
              </div>

              {/* ── TOMBOL DATA MUTASI (baru) ── */}
              <Link
                href="/admin/mutasi"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap transition-colors"
                title="Lihat Data Mutasi SDM"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <span className="hidden sm:inline">Data Mutasi</span>
                <span className="sm:hidden">Mutasi</span>
              </Link>

              {/* Tombol Export PDF (tidak berubah) */}
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                title="Export PDF"
              >
                {exportingPDF ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Mengekspor...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </>
                )}
              </button>

              <div className="text-black font-bold">
                <span>PELINDO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Tabel Rekap SDM Konsolidasi */}
        {selectedPeriod && selectedPeriod.split("-")[0] !== "all" && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 overflow-x-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              {(() => {
                if (!selectedPeriod || selectedPeriod.split("-")[0] === "all") {
                  return "REKAPITULASI JUMLAH SDM PT PELINDO MULTI TERMINAL (KONSOLIDASI)";
                }
                const bulan = parseInt(selectedPeriod.split("-")[0]);
                const tahun = parseInt(selectedPeriod.split("-")[1]);
                const bulanName = bulanNames[bulan - 1];
                const totalRow = rekapSDM.find((row) => row.status === "Jumlah");
                const totalKaryawan = totalRow ? totalRow.realisasiBulanIni : 0;
                return `Realisasi Jumlah SDM PT Pelindo Multi Terminal (Konsolidasi) s.d ${bulanName} ${tahun} sebesar ${totalKaryawan.toLocaleString("id-ID")} Orang`;
              })()}
            </h2>

            {loadingRekap ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Memuat data rekap...</span>
              </div>
            ) : rekapSDM.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="border border-gray-300 px-4 py-3 text-left font-bold text-white min-w-[280px] w-[280px]">STATUS</th>
                      <th className="border border-gray-300 px-3 py-3 text-left font-bold text-white">SATUAN</th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          return (<><div>REALISASI</div><div>{bulanNamesUpper[bulan - 1]}</div><div>TH. {tahun - 1}</div></>);
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => { const tahun = parseInt(selectedPeriod.split("-")[1]); return (<><div>RKAP</div><div>TH. {tahun}</div></>); })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1;
                          const tahunSebelumnya = bulan === 1 ? tahun - 1 : tahun;
                          return (<><div>REALISASI</div><div>{bulanNamesUpper[bulanSebelumnya - 1]}</div><div>TH. {tahunSebelumnya}</div></>);
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          return (<><div>REALISASI</div><div>S.D</div><div>{bulanNamesUpper[bulan - 1]}</div><div>TH. {tahun}</div></>);
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight" colSpan={2}>
                        <div>CAPAIAN</div><div>(%)</div>
                      </th>
                    </tr>
                    <tr className="bg-blue-700 text-white">
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-white">YoY</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-white">FY {selectedPeriod.split("-")[1]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapSDM.map((row, index) => {
                      const isTotal = row.status === "Jumlah";
                      return (
                        <tr key={index} className={isTotal ? "bg-gray-100 font-bold border-t-2 border-gray-400 text-black" : "hover:bg-gray-50 text-black"}>
                          <td className="border border-gray-300 px-4 py-3 text-left text-black min-w-[280px] w-[280px]">{row.status}</td>
                          <td className="border border-gray-300 px-3 py-3 text-left text-black">{row.satuan}</td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">{row.realisasiTahunLalu > 0 ? row.realisasiTahunLalu.toLocaleString("id-ID") : "-"}</td>
                          <td
                            className={`border border-gray-300 px-3 py-3 text-right text-black ${isTotal ? "" : "cursor-pointer hover:bg-blue-50 transition-colors"}`}
                            onClick={() => !isTotal && handleRKAPEdit(row.status, row.revisiRKAP)}
                            title={isTotal ? "" : "Klik untuk mengedit nilai RKAP"}
                          >
                            {editingRKAP[row.status] !== undefined ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="number"
                                  value={editingRKAP[row.status]}
                                  onChange={(e) => setEditingRKAP({ ...editingRKAP, [row.status]: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleRKAPSave(row.status); else if (e.key === "Escape") handleRKAPCancel(row.status); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-24 px-2 py-1 border border-blue-500 rounded text-gray-900 text-right"
                                  autoFocus min="0"
                                />
                                <button onClick={(e) => { e.stopPropagation(); handleRKAPSave(row.status); }} disabled={savingRKAP} className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs" title="Simpan">✓</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRKAPCancel(row.status); }} className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs" title="Batal">✕</button>
                              </div>
                            ) : row.revisiRKAP !== null && row.revisiRKAP > 0 ? row.revisiRKAP.toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">{row.realisasiBulanSebelumnya > 0 ? row.realisasiBulanSebelumnya.toLocaleString("id-ID") : "-"}</td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">{row.realisasiBulanIni > 0 ? row.realisasiBulanIni.toLocaleString("id-ID") : "-"}</td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">{row.capaianYoY !== null ? `${row.capaianYoY}%` : "-"}</td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">{row.capaianFY !== null ? `${row.capaianFY}%` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">Tidak ada data rekap untuk periode yang dipilih</div>
            )}
          </div>
        )}

        {/* Tabel Rekap SDM Per Entitas dengan Tab */}
        {selectedPeriod && selectedPeriod.split("-")[0] !== "all" && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 overflow-x-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">
              REKAPITULASI SDM PER ENTITAS
            </h2>
            <p className="text-center text-gray-500 text-sm mb-5">
              {(() => {
                const bulan = parseInt(selectedPeriod.split("-")[0]);
                const tahun = parseInt(selectedPeriod.split("-")[1]);
                const totalRow = rekapSDMEntitas?.[activeEntitasTab]?.find((r) => r.status === "Jumlah");
                const total = totalRow ? totalRow.realisasi : 0;
                return `Realisasi s.d ${bulanNames[bulan - 1]} ${tahun} — ${activeEntitasTab.toUpperCase()}: ${total.toLocaleString("id-ID")} Orang`;
              })()}
            </p>

            {/* Tabs SPMT / PTP / IKT / TCU */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 rekap-entitas-tabs">
              {ENTITAS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveEntitasTab(tab.key)}
                  className={`px-6 py-2.5 text-sm font-bold rounded-t-lg transition-all duration-150 border-b-2 -mb-px ${
                    activeEntitasTab === tab.key
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-gray-100 text-gray-600 border-transparent hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingRekapEntitas ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Memuat data per entitas...</span>
              </div>
            ) : rekapSDMEntitas && (rekapSDMEntitas[activeEntitasTab]?.length ?? 0) > 0 ? (
              <>
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="border border-gray-300 px-4 py-3 text-left font-bold text-white min-w-[200px]">STATUS SDM</th>
                      <th className="border border-gray-300 px-3 py-3 text-left font-bold text-white">SATUAN</th>
                      <th className="border border-gray-300 px-3 py-3 text-center font-bold text-white">RKAP {selectedPeriod.split("-")[1]}</th>
                      <th className="border border-gray-300 px-3 py-3 text-center font-bold text-white leading-tight">
                        <div>REALISASI S.D</div>
                        <div>
                          {(() => {
                            const bulan = parseInt(selectedPeriod.split("-")[0]);
                            const tahun = parseInt(selectedPeriod.split("-")[1]);
                            return `${bulanNamesUpper[bulan - 1]} ${tahun}`;
                          })()}
                        </div>
                      </th>
                      <th className="border border-gray-300 px-3 py-3 text-center font-bold text-white">SELISIH</th>
                      <th className="border border-gray-300 px-3 py-3 text-center font-bold text-white">CAPAIAN (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapSDMEntitas[activeEntitasTab].map((row, index) => {
                      const isTotal = row.status === "Jumlah";
                      return (
                        <tr key={index} className={isTotal ? "bg-gray-100 font-bold border-t-2 border-gray-400 text-black" : "hover:bg-gray-50 text-black"}>
                          <td className="border border-gray-300 px-4 py-3 text-left text-black">{row.status}</td>
                          <td className="border border-gray-300 px-3 py-3 text-left text-black">{row.satuan}</td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.rkap !== null && row.rkap > 0 ? row.rkap.toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.realisasi > 0 ? row.realisasi.toLocaleString("id-ID") : "-"}
                          </td>
                          <td className={`border border-gray-300 px-3 py-3 text-right ${getSelisihColor(row.selisih)}`}>
                            {row.selisih !== null ? row.selisih.toLocaleString("id-ID") : "-"}
                          </td>
                          <td className={`border border-gray-300 px-3 py-3 text-right ${getCapaianColor(row.capaian)}`}>
                            {row.capaian !== null ? `${row.capaian.toFixed(2)}%` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                    Capaian ≥ 100%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
                    Capaian 90–99%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                    Capaian &lt; 90%
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Tidak ada data rekap untuk entitas dan periode yang dipilih
              </div>
            )}
          </div>
        )}

        {/* PERSENTASE JUMLAH SDM Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">PERSENTASE JUMLAH SDM</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Memuat data...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* SPMT Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">JUMLAH SDM SPMT</h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.spmt && sdmOperasional.spmt.total > 0 ? (
                    <Doughnut
                      data={{ labels: ["Non Operasional", "Operasional"], datasets: [{ data: [sdmOperasional.spmt.nonOperasional, sdmOperasional.spmt.operasional], backgroundColor: ["#60A5FA", "#1E40AF"], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (value: number) => { const total = sdmOperasional.spmt.total; return `${total > 0 ? Math.round((value / total) * 100) : 0}%`; }, color: "#fff", font: { weight: "bold", size: 12 }, textAlign: "center" } }, cutout: "50%" }}
                    />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Data</div>}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">{sdmOperasional?.spmt?.total || 0} Org</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-200 rounded mr-2"></div><span className="text-gray-700">Non Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.spmt?.nonOperasional || 0} Org</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-600 rounded mr-2"></div><span className="text-gray-700">Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.spmt?.operasional || 0} Org</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PTP Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">JUMLAH SDM PTP</h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.ptp && sdmOperasional.ptp.total > 0 ? (
                    <Doughnut
                      data={{ labels: ["Non Operasional", "Operasional"], datasets: [{ data: [sdmOperasional.ptp.nonOperasional, sdmOperasional.ptp.operasional], backgroundColor: ["#60A5FA", "#1E40AF"], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (value: number) => { const total = sdmOperasional.ptp.total; return `${total > 0 ? Math.round((value / total) * 100) : 0}%`; }, color: "#fff", font: { weight: "bold", size: 12 }, textAlign: "center" } }, cutout: "50%" }}
                    />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Data</div>}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">{sdmOperasional?.ptp?.total || 0} Org</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-200 rounded mr-2"></div><span className="text-gray-700">Non Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.ptp?.nonOperasional || 0} Org</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-600 rounded mr-2"></div><span className="text-gray-700">Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.ptp?.operasional || 0} Org</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* IKT Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">JUMLAH SDM IKT</h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.ikt && sdmOperasional.ikt.total > 0 ? (
                    <Doughnut
                      data={{ labels: ["Non Operasional", "Operasional"], datasets: [{ data: [sdmOperasional.ikt.nonOperasional, sdmOperasional.ikt.operasional], backgroundColor: ["#60A5FA", "#1E40AF"], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (value: number) => { const total = sdmOperasional.ikt.total; return `${total > 0 ? Math.round((value / total) * 100) : 0}%`; }, color: "#fff", font: { weight: "bold", size: 12 }, textAlign: "center" } }, cutout: "50%" }}
                    />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Data</div>}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">{sdmOperasional?.ikt?.total || 0} Org</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-200 rounded mr-2"></div><span className="text-gray-700">Non Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.ikt?.nonOperasional || 0} Org</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-600 rounded mr-2"></div><span className="text-gray-700">Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.ikt?.operasional || 0} Org</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TCU Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">JUMLAH SDM TCU</h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.tcu && sdmOperasional.tcu.total > 0 ? (
                    <Doughnut
                      data={{ labels: ["Non Operasional", "Operasional"], datasets: [{ data: [sdmOperasional.tcu.nonOperasional, sdmOperasional.tcu.operasional], backgroundColor: ["#60A5FA", "#1E40AF"], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (value: number) => { const total = sdmOperasional.tcu.total; return `${total > 0 ? Math.round((value / total) * 100) : 0}%`; }, color: "#fff", font: { weight: "bold", size: 12 }, textAlign: "center" } }, cutout: "50%" }}
                    />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Data</div>}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">{sdmOperasional?.tcu?.total || 0} Org</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-200 rounded mr-2"></div><span className="text-gray-700">Non Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.tcu?.nonOperasional || 0} Org</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center"><div className="w-4 h-4 bg-blue-600 rounded mr-2"></div><span className="text-gray-700">Operasional</span></div>
                      <span className="font-semibold text-gray-800">{sdmOperasional?.tcu?.operasional || 0} Org</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-200 rounded"></div><span className="text-sm text-gray-700">Non Operasional</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-600 rounded"></div><span className="text-sm text-gray-700">Operasional</span></div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {role !== "admin_pembelajaran" && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Upload Data</h4>
              <p className="text-gray-600 mb-4">Upload file Excel atau CSV untuk mengupdate data dashboard.</p>
              <a href="/admin/upload-data" className="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors">Upload Data</a>
            </div>
          )}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Kelola Akun</h4>
            <p className="text-gray-600 mb-4">Kelola pengguna sistem, tambah, edit, atau hapus akun pengguna.</p>
            <a href="/admin/users" className="inline-block bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">Kelola Akun</a>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Pengaturan Sistem</h4>
            <p className="text-gray-600 mb-4">Konfigurasi pengaturan sistem dan preferensi aplikasi.</p>
            <a href="/admin/settings" className="inline-block bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors">Pengaturan</a>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Refresh Data</h4>
            <p className="text-gray-600 mb-4">Refresh dashboard untuk melihat data terbaru dari database.</p>
            <button onClick={refreshData} className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors">Refresh Dashboard</button>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
      @page { margin: 0; size: auto; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        nav, nav * { display: none !important; }
        aside, [class*="sidebar"], [class*="Sidebar"] { display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; }
        .rekap-entitas-tabs { display: none !important; }
        button[onclick*="handleExportPDF"], select, div[class*="bg-blue-500"]:has(select), input[type="number"] { display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; opacity: 0 !important; }
        .grid.grid-cols-1.lg\\:grid-cols-4 { display: none !important; }
        body, html { background-color: #ffffff !important; margin: 0 !important; padding: 0 !important; }
        @page { margin: 0.5cm !important; background: white !important; }
        table, table thead, table tbody, table tr, table th, table td { display: table !important; visibility: visible !important; opacity: 1 !important; border: 1px solid #000000 !important; border-collapse: collapse !important; }
        table thead { display: table-header-group !important; }
        table tbody { display: table-row-group !important; }
        table tr { display: table-row !important; }
        table th, table td { display: table-cell !important; padding: 8px !important; border: 1px solid #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        table th[class*="bg-blue-700"] { background-color: #1e40af !important; color: #ffffff !important; }
        table tr[class*="bg-gray-100"] { background-color: #f3f4f6 !important; }
        canvas { display: block !important; visibility: visible !important; opacity: 1 !important; width: 100% !important; height: 128px !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        div[class*="h-32"] { height: 128px !important; min-height: 128px !important; display: block !important; }
        div[class*="grid"][class*="lg:grid-cols-4"] { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 1.5rem !important; }
        h1, h2, h3, h4, h5, h6, span, p { display: block !important; visibility: visible !important; color: #000000 !important; }
        div[class*="animate-spin"] { display: none !important; }
      }
      ` }} />
    </div>
  );
}