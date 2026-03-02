"use client";

import { useState, useEffect, useRef } from "react";
import { FiDownload } from "react-icons/fi";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

// Consistent number formatter (match regional dashboard style)
const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "0";
  const n = Number(value);
  if (isNaN(n)) return "0";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
};

interface TableData {
  npp: string;
  nama: string;
  tanggal_lahir: string;
  jabatan: string;
  entitas: string;
  unit_kerja: string;
  kategori: string;
  jenis_kelamin: string;
  pendidikan?: string;
  organik_non_organik: string;
  pusat_pelayanan: string;
  non_operasional: string;
  status_laporan: string;
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
  chartData: ChartData;
}

interface UnitKerja {
  id: string;
  nama: string;
  kode: string;
  unit_kerja?: string;
  employee_count: number;
  ptp_daerah_id?: string;
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

interface BopoData {
  bopo_ratio: number | null;
  produktivitas_efisiensi: number | null;
  rasio_beban_penghasilan_usaha: number | null;
  bulan: number | null;
  tahun: number | null;
}

export default function PTPDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [fullTableData, setFullTableData] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerja[]>([]);
  const [selectedUnitKerja, setSelectedUnitKerja] = useState<string>("all");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);
  const [, setPagination] = useState<PaginationInfo | null>(null);
  const [strukturImage, setStrukturImage] = useState<any | null>(null);
  const [bopoData, setBopoData] = useState<BopoData | null>(null);
  // CRUD state for Kompetensi/Diklat/Dampak
  const [kompetensiId, setKompetensiId] = useState<number | null>(null);
  const [kompetensiIsi, setKompetensiIsi] = useState<string>("");
  const [diklatId, setDiklatId] = useState<number | null>(null);
  const [diklatIsi, setDiklatIsi] = useState<string>("");
  const [dampakId, setDampakId] = useState<number | null>(null);
  const [dampakIsi, setDampakIsi] = useState<string>("");
  const [savingJenis, setSavingJenis] = useState<
    null | "KOMPETENSI" | "DIKLAT" | "DAMPAK"
  >(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUnitKerjaList();
    fetchAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      setCurrentPage(1);
      fetchDashboardData();
      fetchTableData();
      fetchStrukturOrganisasi();
      fetchBopoData();
      fetchKompetensiData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitKerja, selectedPeriod]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchUnitKerjaList = async () => {
    try {
      const response = await fetch("/api/admin/ptp-unit-kerja");
      if (!response.ok) {
        console.error("Failed to fetch PTP unit kerja list");
        return;
      }
      const data = await response.json();
      const ptpUnitKerjaList: UnitKerja[] = data.data || [];

      // Resolve ALL konsolidasi id from DB (kode='ALL'), fallback '50'
      let allDaerahId = "50";
      try {
        const daerahResp = await fetch("/api/admin/ptp-daerah");
        if (daerahResp.ok) {
          const daerahJson = await daerahResp.json();
          const daerahList: { id: number; kode: string }[] =
            daerahJson.data || [];
          const allRow = daerahList.find(
            (d) => (d.kode || "").toUpperCase() === "ALL"
          );
          if (allRow) allDaerahId = String(allRow.id);
        }
      } catch {
        /* ignore */
      }

      const allOption: UnitKerja = {
        id: "all",
        nama: "Konsolidasi PTP (Semua Branch)",
        kode: "StandAlone",
        employee_count: ptpUnitKerjaList.reduce(
          (sum, u) => sum + (u.employee_count || 0),
          0
        ),
        ptp_daerah_id: allDaerahId, // penting: map ke id ALL dari DB
      };

      setUnitKerjaList([allOption, ...ptpUnitKerjaList]);
    } catch (error) {
      console.error("Error fetching PTP unit kerja list:", error);
    }
  };

  const fetchAvailablePeriods = async () => {
    try {
      const response = await fetch("/api/admin/ptp-available-months");
      if (response.ok) {
        const data = await response.json();
        const periods = data.data || [];
        setAvailablePeriods(periods);
        if (periods.length > 0) {
          setSelectedPeriod(periods[0].value);
        }
      } else {
        console.error("Failed to fetch available periods");
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
    }
  };

  const fetchStrukturOrganisasi = async () => {
    try {
      if (selectedUnitKerja === "all") {
        setStrukturImage(null);
        return;
      }
      const selectedUnit = unitKerjaList.find(
        (unit) => unit.id === selectedUnitKerja
      );
      console.log("Selected unit:", selectedUnit);
      console.log("Unit kerja list:", unitKerjaList);

      if (!selectedUnit?.ptp_daerah_id) {
        console.log("No ptp_daerah_id found for selected unit:", selectedUnit);
        setStrukturImage(null);
        return;
      }

      console.log(
        "Fetching structure for ptp_daerah_id:",
        selectedUnit.ptp_daerah_id
      );
      const response = await fetch(
        `/api/admin/ptp-struktur-organisasi/by-daerah/${selectedUnit.ptp_daerah_id}`
      );

      console.log("API response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Structure data received:", data);
        setStrukturImage(data.data);
      } else if (response.status === 404) {
        // Struktur organisasi tidak ditemukan - ini normal, tidak perlu error
        console.log("No organizational structure found for this region");
        setStrukturImage(null);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch PTP struktur organisasi:", errorData);
        setStrukturImage(null);
      }
    } catch (error) {
      console.error("Error fetching PTP struktur organisasi:", error);
      setStrukturImage(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      if (!selectedPeriod) return;

      const [month, year] = selectedPeriod.split("-");
      const unitKerjaParam =
        selectedUnitKerja === "all" ? "all" : getSelectedUnitKerjaValue();

      const params = new URLSearchParams({
        month: month,
        year: year,
        unit_kerja: unitKerjaParam,
      });

      const response = await fetch(`/api/admin/ptp-dashboard-stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else {
        console.error("Failed to fetch PTP dashboard stats");
      }
    } catch (error) {
      console.error("Error fetching PTP dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async () => {
    try {
      if (!selectedPeriod) return;

      const [month, year] = selectedPeriod.split("-");
      const unitKerjaParam =
        selectedUnitKerja === "all" ? "all" : getSelectedUnitKerjaValue();

      const params = new URLSearchParams({
        month: month,
        year: year,
        unit_kerja: unitKerjaParam,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const response = await fetch(`/api/admin/ptp-table-data?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTableData(data.data || []);
        setPagination(data.pagination);
      } else {
        console.error("Failed to fetch PTP table data");
      }

      // Fetch larger slice for accurate pendidikan chart aggregation
      const bigParams = new URLSearchParams({
        month: month,
        year: year,
        unit_kerja: unitKerjaParam,
        page: "1",
        limit: "10000",
      });
      const bigResp = await fetch(`/api/admin/ptp-table-data?${bigParams}`);
      if (bigResp.ok) {
        const bigData = await bigResp.json();
        setFullTableData(bigData.data || []);
      } else {
        setFullTableData([]);
      }
    } catch (error) {
      console.error("Error fetching PTP table data:", error);
    }
  };

  const getSelectedUnitKerjaValue = () => {
    const selectedUnit = unitKerjaList.find(
      (unit) => unit.id === selectedUnitKerja
    );
    // Return the ID for API filtering, not the name
    return selectedUnit?.id || "";
  };


  const selectedUnitKerjaInfo = unitKerjaList.find(
    (unit) => unit.id === selectedUnitKerja
  );

  // Compute Pendidikan distribution (real data) from fullTableData
  const pendidikanDistribution = (() => {
    const buckets: Record<string, number> = {
      S3: 0,
      S2: 0,
      S1: 0,
      Diploma: 0,
      SMA: 0,
    };

    const normalize = (val: string): keyof typeof buckets | null => {
      const v = (val || "").toString().trim().toUpperCase();
      if (!v) return null;
      const compact = v.replace(/\s+/g, "").replace(/[\.-]/g, "");
      // SMA family (map SMP to SMA)
      if (/(SMA|SMK|SMU|SLTA|SMP)/.test(v)) return "SMA";
      // Diploma family (D1, D2, D3) - mapped to Diploma category
      if (/^(DI|D1|D-1|D\.1)$/.test(v) || /^DI$/.test(compact))
        return "Diploma";
      if (/^(DII|D2|D-2|D\.2)$/.test(v) || /^DII$/.test(compact))
        return "Diploma";
      if (/^(DIII|D3|D-3|D\.3)$/.test(v) || /^DIII$/.test(compact))
        return "Diploma";
      // D4/DIV treated as S1
      if (/^(DIV|D4|D-4|D\.4)$/.test(v) || /^DIV$/.test(compact)) return "S1";
      // S1/S2/S3 variants
      if (/^(S1|S-1|S\.1|SARJANA|STRATA1)$/.test(v) || /^S1$/.test(compact))
        return "S1";
      if (/^(S2|S-2|S\.2|MAGISTER|STRATA2)$/.test(v) || /^S2$/.test(compact))
        return "S2";
      if (/^(S3|S-3|S\.3|DOKTOR|STRATA3)$/.test(v) || /^S3$/.test(compact))
        return "S3";
      return null;
    };

    const source = fullTableData.length > 0 ? fullTableData : tableData;
    if (!source || source.length === 0) {
      return {
        labels: Object.keys(buckets),
        values: Object.values(buckets),
        total: 0,
      };
    }
    for (const row of source) {
      const norm = normalize(row.pendidikan || "");
      if (norm && buckets.hasOwnProperty(norm)) buckets[norm] += 1;
    }
    const labels = Object.keys(buckets);
    const values = labels.map((k) => buckets[k]);
    const total = values.reduce((a, b) => a + b, 0);
    return { labels, values, total };
  })();

  const handleDownloadExcel = async () => {
    try {
      if (!selectedPeriod) return;
      const [month, year] = selectedPeriod.split("-");
      // Always export all units
      const unitKerjaParam = "all";
      const params = new URLSearchParams({
        month,
        year,
        unit_kerja: unitKerjaParam,
        export: "excel",
      });
      const url = `/api/admin/ptp-table-data?${params.toString()}`;
      // Use browser download by navigating to the URL
      window.open(url, "_blank");
    } catch (e) {
      console.error("Failed to download Excel:", e);
    }
  };

  const handleExportPdf = () => {
    if (!dashboardRef.current) {
      alert("Tidak ada data untuk diekspor");
      return;
    }

    try {
      setExporting(true);
      // Gunakan window.print() untuk format print browser seperti Google Chrome
      window.print();
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Gagal mengekspor ke PDF. Silakan coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  // Load Kompetensi/Diklat/Dampak for selected unit & period
  const fetchKompetensiData = async () => {
    try {
      const selectedUnit = unitKerjaList.find(
        (u) => u.id === selectedUnitKerja
      );
      if (!selectedUnit?.ptp_daerah_id || !selectedPeriod) {
        setKompetensiId(null);
        setKompetensiIsi("");
        setDiklatId(null);
        setDiklatIsi("");
        setDampakId(null);
        setDampakIsi("");
        return;
      }

      // Validasi: periode tidak boleh "all"
      const [month, year] = selectedPeriod.split("-");
      const periodObj = availablePeriods.find(
        (p) => p.value === selectedPeriod
      );
      if (
        (periodObj && periodObj.type === "consolidation") ||
        selectedPeriod.startsWith("all-") ||
        month === "all"
      ) {
        // Jika periode adalah "all", tidak bisa memuat/mengelola data
        setKompetensiId(null);
        setKompetensiIsi("");
        setDiklatId(null);
        setDiklatIsi("");
        setDampakId(null);
        setDampakIsi("");
        return;
      }

      const params = new URLSearchParams({
        ptp_daerah_id: String(selectedUnit.ptp_daerah_id),
        month,
        year,
      });
      const resp = await fetch(
        `/api/admin/ptp-kompetensi?${params.toString()}`
      );
      if (!resp.ok) {
        setKompetensiId(null);
        setKompetensiIsi("");
        setDiklatId(null);
        setDiklatIsi("");
        setDampakId(null);
        setDampakIsi("");
        return;
      }
      const json = await resp.json();
      const rows: any[] = json.data || [];
      const byJenis = (jenis: string) => rows.find((r) => r.jenis === jenis);
      const k = byJenis("KOMPETENSI");
      const d = byJenis("DIKLAT");
      const p = byJenis("DAMPAK");
      setKompetensiId(k?.id ?? null);
      setKompetensiIsi(k?.isi ?? "");
      setDiklatId(d?.id ?? null);
      setDiklatIsi(d?.isi ?? "");
      setDampakId(p?.id ?? null);
      setDampakIsi(p?.isi ?? "");
    } catch (e) {
      console.error("Failed to fetch ptp-kompetensi", e);
    }
  };

  // Save Kompetensi/Diklat/Dampak
  const saveKompetensi = async (jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK") => {
    try {
      // Validasi: periode tidak boleh "all"
      if (!selectedPeriod) {
        alert("Silakan pilih periode terlebih dahulu.");
        return;
      }

      const [month, year] = selectedPeriod.split("-");
      const periodObj = availablePeriods.find(
        (p) => p.value === selectedPeriod
      );

      if (
        (periodObj && periodObj.type === "consolidation") ||
        selectedPeriod.startsWith("all-") ||
        month === "all"
      ) {
        alert(
          "Tidak dapat upload kompetensi/kebutuhan/dampak jika periode adalah 'All'. Silakan pilih periode spesifik (bulan tertentu)."
        );
        return;
      }

      const selectedUnit = unitKerjaList.find(
        (u) => u.id === selectedUnitKerja
      );
      if (!selectedUnit?.ptp_daerah_id) {
        alert("Silakan pilih unit kerja terlebih dahulu.");
        return;
      }

      if (selectedUnitKerja === "all") {
        alert(
          "Silakan pilih unit kerja spesifik untuk menyimpan kompetensi/diklat/dampak."
        );
        return;
      }

      setSavingJenis(jenis);
      const isi =
        jenis === "KOMPETENSI"
          ? kompetensiIsi
          : jenis === "DIKLAT"
          ? diklatIsi
          : dampakIsi;
      const id =
        jenis === "KOMPETENSI"
          ? kompetensiId
          : jenis === "DIKLAT"
          ? diklatId
          : dampakId;

      if (id) {
        await fetch(`/api/admin/ptp-kompetensi/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jenis, isi }),
        });
      } else {
        await fetch(`/api/admin/ptp-kompetensi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ptp_daerah_id: selectedUnit.ptp_daerah_id,
            month,
            year,
            jenis,
            isi,
          }),
        });
      }
      await fetchKompetensiData();
    } catch (e) {
      console.error("Failed to save ptp-kompetensi", e);
      alert("Gagal menyimpan data. Silakan coba lagi.");
    } finally {
      setSavingJenis(null);
    }
  };

  const fetchBopoData = async () => {
    try {
      const selectedUnit = unitKerjaList.find(
        (unit) => unit.id === selectedUnitKerja
      );
      if (!selectedUnit || !selectedUnit.ptp_daerah_id || !selectedPeriod) {
        setBopoData(null);
        return;
      }

      const periodObj = availablePeriods.find(
        (p) => p.value === selectedPeriod
      );
      if (
        (periodObj && periodObj.type === "consolidation") ||
        selectedPeriod.startsWith("all-")
      ) {
        setBopoData(null);
        return;
      }

      const [month, year] = selectedPeriod.split("-");
      const params = new URLSearchParams({
        daerah_id: String(selectedUnit.ptp_daerah_id),
        month,
        year,
      });
      const resp = await fetch(
        `/api/admin/bopo-ptp-dashboard?${params.toString()}`
      );
      if (!resp.ok) {
        setBopoData(null);
        return;
      }
      const json = await resp.json();
      setBopoData(json.data || null);
    } catch (e) {
      console.error("Failed to fetch BOPO PTP:", e);
      setBopoData(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading PTP Dashboard..</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page {
          margin: 0;
          size: auto;
        }
        @media print {
          /* PASTIKAN HEADER DASHBOARD TETAP MUNCUL - ATURAN INI HARUS DIPRIORITASKAN */
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container > div[class*="bg-gradient-to-r"] *,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > h1,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > p,
          .dashboard-container h1,
          .dashboard-container p {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            opacity: 1 !important;
            color: #000000 !important;
          }
          
          /* Pastikan warna tetap muncul saat print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Sembunyikan navbar saat print */
          nav,
          nav * {
            display: none !important;
          }
          
          /* Sembunyikan sidebar - pastikan tidak menyembunyikan header dashboard */
          aside,
          [class*="sidebar"],
          [class*="Sidebar"],
          div[class*="w-64"]:not([class*="px-"]):not([class*="bg-gradient"]):not([class*="text-black"]),
          div[class*="w-16"]:not([class*="px-"]):not([class*="bg-gradient"]):not([class*="text-black"]),
          div[class*="sticky"][class*="h-screen"]:not([class*="bg-gradient"]):not([class*="text-black"]),
          div[class*="from-slate-900"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]),
          div[class*="via-blue-900"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]),
          div[class*="to-blue-700"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]) {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          /* JANGAN sembunyikan header dashboard - HARUS TETAP MUNCUL */
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container div[class*="bg-gradient-to-r"],
          .dashboard-container div[class*="from-blue-500"],
          .dashboard-container div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > h1,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > p {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            opacity: 1 !important;
          }
          
          /* Sembunyikan spacer setelah navbar */
          .h-16:first-of-type:not([class*="bg-gradient"]):not([class*="text-black"]):not([class*="from-blue"]),
          div[style*="height: 4rem"]:not([class*="bg-gradient"]):not([class*="text-black"]):not([class*="from-blue"]) {
            display: none !important;
          }
          
          /* Pindahkan konten ke kanan saat print */
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div {
            justify-content: flex-end !important;
            text-align: right !important;
          }
          
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:first-child,
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div:first-child {
            text-align: right !important;
          }
          
          /* PASTIKAN header dashboard TIDAK terkena aturan di atas */
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"] * {
            display: block !important;
            visibility: visible !important;
          }
          
          /* Sembunyikan tombol-tombol export dan dropdown */
          button[onclick*="handleExportPDF"],
          button[onclick*="handleExportPdf"],
          button[onclick*="handleDownloadExcel"],
          button[onclick*="handleExportStrukturPDF"],
          button:has(svg[width="10"]),
          button:has(svg[width="12"]),
          button:has(.h-2\.5),
          button:has(.h-3),
          button:has(.h-4),
          select {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
          }
          
          /* Sembunyikan semua SVG icon di dalam tombol export */
          button[onclick*="handleExportPDF"] svg,
          button[onclick*="handleExportPdf"] svg,
          button[onclick*="handleDownloadExcel"] svg {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Sembunyikan icon FiDownload */
          button[onclick*="handleExportPdf"] .h-2\.5,
          button[onclick*="handleExportPdf"] .h-3,
          button[onclick*="handleExportPdf"] .h-4 {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Sembunyikan sidebar berdasarkan parent container - jangan sembunyikan header dashboard */
          div.flex > div:first-child:not([class*="flex-1"]):not([class*="bg-gradient"]):not([class*="text-black"]) {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          /* PASTIKAN header dashboard TIDAK terkena aturan di atas */
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"] *,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div > div > h1,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div > div > p {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            opacity: 1 !important;
          }
          
          /* Pastikan konten tetap rapi dengan padding normal */
          body,
          html {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Pastikan halaman print bersih - HAPUS HEADER/FOOTER BROWSER */
          @page {
            margin: 0.5cm !important;
            background: white !important;
            /* Hapus header dan footer browser */
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }
          
          /* Sembunyikan semua elemen yang mungkin menampilkan URL */
          header[class*="url"],
          div[class*="url"],
          span[class*="url"],
          a[href*="localhost"],
          a[href*="http"],
          a[href*="https"],
          a[href*="admin"],
          a[href*="user"],
          a[href*="regional"],
          a[href*="ptp"],
          a[href*="ikt"],
          /* Sembunyikan URL di browser print header/footer */
          ::-webkit-scrollbar,
          /* Sembunyikan elemen yang menampilkan URL di print */
          *::before[content*="localhost"],
          *::after[content*="localhost"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
          
          /* Pastikan semua judul dan konten tetap muncul */
          h1, h2, h3, h4, h5, h6 {
            display: block !important;
            visibility: visible !important;
          }
          
          /* Pastikan header dashboard tetap muncul - HARUS TETAP MUNCUL */
          .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container div[class*="from-blue-500"],
          .dashboard-container div[class*="bg-gradient-to-r"]:first-child {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            opacity: 1 !important;
          }
          
          /* Pastikan judul header tetap muncul - HARUS TETAP MUNCUL */
          .dashboard-container h1,
          .dashboard-container h2,
          .dashboard-container h3,
          .dashboard-container p,
          div[class*="px-"] h1,
          div[class*="px-"] h2,
          div[class*="px-"] p,
          .dashboard-container > div[class*="bg-gradient-to-r"] h1,
          .dashboard-container > div[class*="from-blue-500"] h1,
          .dashboard-container > div[class*="bg-gradient-to-r"] p,
          .dashboard-container > div[class*="from-blue-500"] p,
          h1,
          h2,
          p {
            display: block !important;
            visibility: visible !important;
            color: #000000 !important;
            opacity: 1 !important;
          }
          
          /* Pastikan header container tidak disembunyikan - HARUS TETAP MUNCUL */
          .dashboard-container > div[class*="bg-gradient-to-r"] > div,
          .dashboard-container > div[class*="from-blue-500"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div,
          div[class*="px-4"] > div,
          div[class*="px-6"] > div {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Biarkan padding normal untuk konten - jangan full screen */
          div[class*="flex-1"] {
            width: 100% !important;
          }
          
          div.flex {
            gap: 0 !important;
          }
          
          /* Pastikan dashboard tetap rapi dengan padding */
          .dashboard-container {
            width: 100% !important;
          }
          
          /* Pastikan background putih untuk body dan container */
          body,
          html,
          .dashboard-container {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Pastikan background color tetap muncul untuk elemen yang perlu */
          [class*="bg-white"],
          [class*="bg-gray"],
          [class*="bg-blue"]:not([class*="bg-blue-500"]):not([class*="bg-blue-600"]):not([class*="bg-blue-700"]):not([class*="bg-blue-800"]):not([class*="bg-blue-900"]),
          [class*="from-blue-500"],
          [class*="from-blue-600"],
          [class*="from-blue-700"],
          [class*="to-blue-500"],
          [class*="to-blue-600"],
          [class*="to-blue-700"] {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* ATURAN FINAL: PASTIKAN HEADER DASHBOARD TETAP MUNCUL - OVERRIDE SEMUA ATURAN LAIN */
          .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container > div[class*="from-blue-500"],
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container > div[class*="bg-gradient-to-r"] *,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > h1,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > p,
          .dashboard-container h1:first-of-type,
          .dashboard-container p:first-of-type {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
            opacity: 1 !important;
            color: #000000 !important;
            position: relative !important;
          }
          
          /* Sembunyikan tombol-tombol export dan dropdown */
          button[onclick*="handleExportPDF"],
          button[onclick*="handleExportPdf"],
          button[onclick*="handleDownloadExcel"],
          button[onclick*="handleExportStrukturPDF"],
          button:has(svg[width="10"]),
          button:has(svg[width="12"]),
          button:has(.h-2\.5),
          button:has(.h-3),
          button:has(.h-4),
          select,
          select *,
          div:has(select),
          div[class*="bg-blue-500"]:has(select),
          div[class*="bg-blue-600"]:has(select),
          div[class*="from-blue-500"]:has(select),
          div[class*="from-blue-600"]:has(select) {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
          }
          
          /* Sembunyikan container dropdown yang berisi select */
          .dashboard-container select,
          .dashboard-container div:has(select),
          .dashboard-container > div[class*="bg-gradient-to-r"] select,
          .dashboard-container > div[class*="from-blue-500"] select,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div select,
          .dashboard-container > div[class*="from-blue-500"] > div select,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div > div select,
          .dashboard-container > div[class*="from-blue-500"] > div > div select,
          div[class*="bg-blue-500"]:has(select),
          div[class*="bg-blue-600"]:has(select),
          div[class*="from-blue-500"]:has(select),
          div[class*="from-blue-600"]:has(select),
          div[class*="to-blue-500"]:has(select),
          div[class*="to-blue-600"]:has(select),
          /* Sembunyikan div yang berisi select di header */
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:has(select),
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div:has(select),
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div[class*="flex"]:has(select),
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div[class*="flex"]:has(select),
          /* Sembunyikan container flex yang berisi dropdown di header (child kedua) */
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div[class*="flex"]:last-child,
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div[class*="flex"]:last-child,
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div[class*="flex-col"],
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div[class*="flex-col"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:nth-child(2),
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div:nth-child(2) {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
          }
          
          /* Pastikan hanya div pertama (yang berisi h1 dan p) yang muncul */
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:first-child,
          .dashboard-container > div[class*="from-blue-500"] > div[class*="px-"] > div > div:first-child {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
          }
        }
      `,
        }}
      />
      <div
        ref={dashboardRef}
        className="dashboard-container min-h-screen bg-gray-100"
      >
        {/* Header */}
        <div className="bg-gradient-to-r text-black">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">
                DEMOGRAFI SDM PTP -{" "}
                {selectedUnitKerjaInfo?.nama || "Semua Branch"}
              </h1>
              <p className="text-base lg:text-lg">
                PT PELINDO MULTI TERMINAL GRUP
              </p>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="bg-blue-500 px-4 py-2 rounded">
                  <select
                    className="bg-transparent text-white border-none outline-none"
                    value={selectedUnitKerja}
                    onChange={(e) => setSelectedUnitKerja(e.target.value)}
                  >
                    {unitKerjaList.map((unit) => (
                      <option
                        key={unit.id}
                        className="text-black"
                        value={unit.id}
                      >
                        {unit.nama} ({unit.kode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-blue-500 px-4 py-2 rounded">
                  <select
                    className="bg-transparent text-white border-none outline-none"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    {availablePeriods.map((period) => (
                      <option
                        key={period.value}
                        className="text-black"
                        value={period.value}
                      >
                        {period.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  data-export-ignore="true"
                  onClick={handleDownloadExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
                >
                  Export Excel
                </button>
                <button
                  data-export-ignore="true"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded shadow"
                >
                  {exporting ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <FiDownload className="h-2.5 w-2.5" />
                      Export PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 lg:px-6 py-8 space-y-6">
          {/* Charts and Structure */}
          <div className="space-y-8">
            {/* Charts Section - Full Width */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                <h2 className="text-lg font-bold text-center">
                  KONSOLIDASI PTP - {selectedUnitKerjaInfo?.kode || "StandAlone"}
                </h2>
              </div>
              <div className="p-6">
                {stats?.chartData && (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                    {/* Organik vs Non Organik */}
                    <div className="text-center">
                      <h4 className="text-xs font-semibold mb-2 text-black">
                        JENIS PEKERJA
                      </h4>
                      <div className="h-32 mb-2">
                        <Doughnut
                          data={{
                            labels: ["Non Organik", "Organik"],
                            datasets: [
                              {
                                data: [
                                  stats.chartData.nonOrganik || 0,
                                  stats.chartData.organik || 0,
                                ],
                                backgroundColor: ["#60A5FA", "#1E40AF"],
                                borderWidth: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              datalabels: {
                                formatter: (value, context) => {
                                  const data = context.dataset.data.filter(
                                    (val): val is number =>
                                      val !== null && val !== undefined
                                  );
                                  const total = data.reduce((a, b) => a + b, 0);
                                  const percentage =
                                    total > 0
                                      ? Math.round((value / total) * 100)
                                      : 0;
                                  return `${percentage}%`;
                                },
                                color: "#fff",
                                font: {
                                  weight: "bold",
                                  size: 12,
                                },
                                textAlign: "center",
                              },
                            },
                            cutout: "50%",
                          }}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="bg-blue-800 text-white p-1 rounded flex justify-between">
                          <span>Organik</span>
                          <span>{stats.chartData.organik} Org</span>
                        </div>
                        <div className="bg-blue-400 text-white p-1 rounded flex justify-between">
                          <span>Non Organik</span>
                          <span>{stats.chartData.nonOrganik} Org</span>
                        </div>
                      </div>
                    </div>

                    {/* Operasional vs Non Operasional */}
                    <div className="text-center">
                      <h4 className="text-xs font-semibold mb-2 text-black">
                        PUSAT PELAYANAN
                      </h4>
                      <div className="h-32 mb-2">
                        <Doughnut
                          data={{
                            labels: ["Operasional", "Non Operasional"],
                            datasets: [
                              {
                                data: [
                                  stats.chartData.operasional || 0,
                                  stats.chartData.nonOperasional || 0,
                                ],
                                backgroundColor: ["#1E40AF", "#60A5FA"],
                                borderWidth: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              datalabels: {
                                formatter: (value, context) => {
                                  const data = context.dataset.data.filter(
                                    (val): val is number =>
                                      val !== null && val !== undefined
                                  );
                                  const total = data.reduce((a, b) => a + b, 0);
                                  const percentage =
                                    total > 0
                                      ? Math.round((value / total) * 100)
                                      : 0;
                                  return `${percentage}%`;
                                },
                                color: "#fff",
                                font: {
                                  weight: "bold",
                                  size: 12,
                                },
                                textAlign: "center",
                              },
                            },
                            cutout: "50%",
                          }}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="bg-blue-800 text-white p-1 rounded flex justify-between">
                          <span>Operasional</span>
                          <span>{stats.chartData.operasional} Org</span>
                        </div>
                        <div className="bg-blue-400 text-white p-1 rounded flex justify-between">
                          <span>Non Operasional</span>
                          <span>{stats.chartData.nonOperasional} Org</span>
                        </div>
                      </div>
                    </div>

                    {/* Gender Distribution */}
                    <div className="text-center">
                      <h4 className="text-xs font-semibold mb-2 text-black">
                        JENIS KELAMIN
                      </h4>
                      <div className="h-32 mb-2">
                        <Doughnut
                          data={{
                            labels: ["Perempuan", "Laki-laki"],
                            datasets: [
                              {
                                data: [
                                  stats.chartData.perempuan || 0,
                                  stats.chartData.lakiLaki || 0,
                                ],
                                backgroundColor: ["#60A5FA", "#1E40AF"],
                                borderWidth: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              datalabels: {
                                formatter: (value, context) => {
                                  const data = context.dataset.data.filter(
                                    (val): val is number =>
                                      val !== null && val !== undefined
                                  );
                                  const total = data.reduce((a, b) => a + b, 0);
                                  const percentage =
                                    total > 0
                                      ? Math.round((value / total) * 100)
                                      : 0;
                                  return `${percentage}%`;
                                },
                                color: "#fff",
                                font: {
                                  weight: "bold",
                                  size: 12,
                                },
                                textAlign: "center",
                              },
                            },
                            cutout: "50%",
                          }}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="bg-blue-800 text-white p-1 rounded flex justify-between">
                          <span>Laki-laki</span>
                          <span>{stats.chartData.lakiLaki} Org</span>
                        </div>
                        <div className="bg-blue-400 text-white p-1 rounded flex justify-between">
                          <span>Perempuan</span>
                          <span>{stats.chartData.perempuan} Org</span>
                        </div>
                      </div>
                    </div>

                    {/* Pendidikan */}
                    <div className="text-center sm:col-span-2 lg:col-span-2">
                      <h4 className="text-xs font-semibold mb-2 text-black">
                        PENDIDIKAN
                      </h4>
                      <div className="h-56 mb-2">
                        {pendidikanDistribution.total > 0 ? (
                          <Doughnut
                            data={{
                              labels: pendidikanDistribution.labels,
                              datasets: [
                                {
                                  data: pendidikanDistribution.values,
                                  backgroundColor: [
                                    "#1E40AF",
                                    "#22c55e",
                                    "#6366f1",
                                    "#f59e0b",
                                    "#ef4444",
                                  ],
                                  borderWidth: 0,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { display: false },
                                datalabels: {
                                  formatter: (value, context) => {
                                    const data = context.dataset.data.filter(
                                      (val): val is number =>
                                        val !== null && val !== undefined
                                    );
                                    const total = data.reduce(
                                      (a, b) => a + b,
                                      0
                                    );
                                    const percentage =
                                      total > 0
                                        ? Math.round((value / total) * 100)
                                        : 0;
                                    return `${percentage}%`;
                                  },
                                  color: "#fff",
                                  font: {
                                    weight: "bold",
                                    size: 12,
                                  },
                                  textAlign: "center",
                                },
                              },
                              cutout: "50%",
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                            No Data
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {pendidikanDistribution.labels.map((label, idx) => (
                          <div
                            key={label}
                            className="flex items-center justify-between bg-blue-400 text-white-900 p-1 rounded"
                          >
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block w-4 h-4 rounded-full"
                                style={{
                                  backgroundColor: [
                                    "#1E40AF",
                                    "#22c55e",
                                    "#6366f1",
                                    "#f59e0b",
                                    "#ef4444",
                                  ][idx],
                                }}
                              />
                              {label}
                            </span>
                            <span>
                              {pendidikanDistribution.values[idx]} org
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Section */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                <h2 className="text-lg font-bold text-center">
                  JUMLAH - {selectedUnitKerjaInfo?.kode || "StandAlone"}
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Pekerja */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {stats?.chartData.total || 0}
                      </div>
                      <div className="text-sm mt-2">JUMLAH PEKERJA</div>
                    </div>
                  </div>

                  {/* Produktivitas */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        Rp{" "}
                        {formatNumber(
                          bopoData?.produktivitas_efisiensi ?? null
                        )}
                      </div>
                      <div className="text-sm mt-2">PRODUKTIVITAS</div>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl">
                      <div className="text-center">
                        <div className="text-xl font-bold">
                          {formatNumber(bopoData?.bopo_ratio ?? null)}%
                        </div>
                        <div className="text-xs">BOPO</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl">
                      <div className="text-center">
                        <div className="text-xl font-bold">
                          {formatNumber(
                            bopoData?.rasio_beban_penghasilan_usaha ?? null
                          )}
                          %
                        </div>
                        <div className="text-xs">
                          RASIO BEBAN PENGHASILAN/BEBAN USAHA
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Kompetensi Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Kolom Kanan: Kompetensi, Diklat, Dampak */}
              <div className="col-span-3 space-y-6">
                {/* Kompetensi Saat Ini */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-yellow-200 text-gray-800 px-6 py-3">
                    <h2 className="text-sm sm:text-base font-bold text-center">
                      KOMPETENSI SAAT INI
                    </h2>
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk menyimpan kompetensi/diklat/dampak.
                      </div>
                    ) : (
                      (() => {
                        const periodObj = availablePeriods.find(
                          (p) => p.value === selectedPeriod
                        );
                        const isAllPeriod =
                          (periodObj && periodObj.type === "consolidation") ||
                          (selectedPeriod &&
                            selectedPeriod.startsWith("all-")) ||
                          (selectedPeriod &&
                            selectedPeriod.split("-")[0] === "all");

                        if (isAllPeriod) {
                          return (
                            <div className="text-gray-500 text-sm text-center">
                              Tidak dapat upload kompetensi jika periode adalah
                              "All". Silakan pilih periode spesifik (bulan
                              tertentu).
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <textarea
                              className="w-full border rounded p-2 text-sm text-gray-900"
                              rows={6}
                              placeholder="Tulis daftar kompetensi/pengetahuan aplikasi..."
                              value={kompetensiIsi}
                              onChange={(e) => setKompetensiIsi(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                              {kompetensiId && (
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Yakin ingin menghapus kompetensi ini?"
                                      )
                                    ) {
                                      fetch(
                                        `/api/admin/ptp-kompetensi/${kompetensiId}`,
                                        { method: "DELETE" }
                                      )
                                        .then(() => fetchKompetensiData())
                                        .catch((e) =>
                                          console.error("Failed to delete", e)
                                        );
                                    }
                                  }}
                                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Hapus
                                </button>
                              )}
                              <button
                                onClick={() => saveKompetensi("KOMPETENSI")}
                                disabled={savingJenis === "KOMPETENSI"}
                                className={`px-3 py-2 text-sm rounded text-white ${
                                  savingJenis === "KOMPETENSI"
                                    ? "bg-blue-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                {savingJenis === "KOMPETENSI"
                                  ? "Menyimpan..."
                                  : "Simpan"}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* Kebutuhan Diklat */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-yellow-200 text-gray-800 px-6 py-3">
                    <h2 className="text-sm sm:text-base font-bold text-center">
                      KEBUTUHAN DIKLAT/PENGEMBANGAN SDM
                    </h2>
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk menyimpan kompetensi/diklat/dampak.
                      </div>
                    ) : (
                      (() => {
                        const periodObj = availablePeriods.find(
                          (p) => p.value === selectedPeriod
                        );
                        const isAllPeriod =
                          (periodObj && periodObj.type === "consolidation") ||
                          (selectedPeriod &&
                            selectedPeriod.startsWith("all-")) ||
                          (selectedPeriod &&
                            selectedPeriod.split("-")[0] === "all");

                        if (isAllPeriod) {
                          return (
                            <div className="text-gray-500 text-sm text-center">
                              Tidak dapat upload kebutuhan diklat jika periode
                              adalah "All". Silakan pilih periode spesifik
                              (bulan tertentu).
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <textarea
                              className="w-full border rounded p-2 text-sm text-gray-900"
                              rows={4}
                              placeholder="Tuliskan kebutuhan diklat/pengembangan SDM..."
                              value={diklatIsi}
                              onChange={(e) => setDiklatIsi(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                              {diklatId && (
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Yakin ingin menghapus kebutuhan diklat ini?"
                                      )
                                    ) {
                                      fetch(
                                        `/api/admin/ptp-kompetensi/${diklatId}`,
                                        { method: "DELETE" }
                                      )
                                        .then(() => fetchKompetensiData())
                                        .catch((e) =>
                                          console.error("Failed to delete", e)
                                        );
                                    }
                                  }}
                                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Hapus
                                </button>
                              )}
                              <button
                                onClick={() => saveKompetensi("DIKLAT")}
                                disabled={savingJenis === "DIKLAT"}
                                className={`px-3 py-2 text-sm rounded text-white ${
                                  savingJenis === "DIKLAT"
                                    ? "bg-blue-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                {savingJenis === "DIKLAT"
                                  ? "Menyimpan..."
                                  : "Simpan"}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* Dampak terhadap Branch */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-yellow-200 text-gray-800 px-6 py-3">
                    <h2 className="text-sm sm:text-base font-bold text-center">
                      DAMPAK TERHADAP BRANCH, APABILA KOMPETENSI TIDAK
                      TERPENUHI.
                    </h2>
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk menyimpan kompetensi/diklat/dampak.
                      </div>
                    ) : (
                      (() => {
                        const periodObj = availablePeriods.find(
                          (p) => p.value === selectedPeriod
                        );
                        const isAllPeriod =
                          (periodObj && periodObj.type === "consolidation") ||
                          (selectedPeriod &&
                            selectedPeriod.startsWith("all-")) ||
                          (selectedPeriod &&
                            selectedPeriod.split("-")[0] === "all");

                        if (isAllPeriod) {
                          return (
                            <div className="text-gray-500 text-sm text-center">
                              Tidak dapat upload dampak jika periode adalah
                              "All". Silakan pilih periode spesifik (bulan
                              tertentu).
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <textarea
                              className="w-full border rounded p-2 text-sm text-gray-900"
                              rows={4}
                              placeholder="Tuliskan dampak terhadap branch jika kompetensi tidak terpenuhi..."
                              value={dampakIsi}
                              onChange={(e) => setDampakIsi(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                              {dampakId && (
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Yakin ingin menghapus dampak ini?"
                                      )
                                    ) {
                                      fetch(
                                        `/api/admin/ptp-kompetensi/${dampakId}`,
                                        { method: "DELETE" }
                                      )
                                        .then(() => fetchKompetensiData())
                                        .catch((e) =>
                                          console.error("Failed to delete", e)
                                        );
                                    }
                                  }}
                                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Hapus
                                </button>
                              )}
                              <button
                                onClick={() => saveKompetensi("DAMPAK")}
                                disabled={savingJenis === "DAMPAK"}
                                className={`px-3 py-2 text-sm rounded text-white ${
                                  savingJenis === "DAMPAK"
                                    ? "bg-blue-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                {savingJenis === "DAMPAK"
                                  ? "Menyimpan..."
                                  : "Simpan"}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
