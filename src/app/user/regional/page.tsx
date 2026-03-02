"use client";

import { useState, useEffect, useRef } from "react";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FiDownload } from 'react-icons/fi';

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
  pendidikan?: string;
  organik_non_organik: string;
  pusat_pelayanan: string;
  non_operasional: string;
  status_laporan_rakomdir: string;
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

interface DashboardStats {
  totalEmployees: number;
  tableData: TableData[];
  chartData: ChartData;
  bopoData: BopoData | null;
}

interface BopoData {
  id: number;
  daerah_id: number;
  daerah_nama: string;
  daerah_kode: string;
  bopo_ratio: number;
  produktivitas_efisiensi: number;
  rasio_beban_penghasilan_usaha: number;
  bulan: number;
  tahun: number;
  keterangan: string;
  created_at: string;
  updated_at: string;
}

interface Daerah {
  id: number;
  nama: string;
  kode: string;
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


const formatNumber = (value: number | string | null) => {
  if (value === null || value === undefined || value === "") return "0";

  // Convert to number if it's a string
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  // Check if conversion resulted in a valid number
  if (isNaN(numValue)) return "0";

  // Remove trailing zeros by converting to number and back to string
  // This handles cases like 5.0000 -> 5, 5.5000 -> 5.5, etc.
  const formattedValue = parseFloat(numValue.toString());

  // Format large numbers with commas for thousands separator
  // Handle all numbers, not just those >= 1000, to ensure consistent formatting
  return formattedValue.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
    useGrouping: true,
  });
};

export default function RegionalDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [daerahList, setDaerahList] = useState<Daerah[]>([]);
  const [selectedDaerah, setSelectedDaerah] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
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
  const [fullTableData, setFullTableData] = useState<TableData[]>([]);
  const regionalRef = useRef<HTMLDivElement>(null);

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

      // SMA family (map SMP to SMA bucket temporarily for secondary education grouping)
      if (/(SMA|SMK|SMU|SLTA|SMP)/.test(v)) return "SMA";

      // Diploma family (D1, D2, D3) - mapped to Diploma category
      if (/^(DI|D1|D-1|D\.1)$/.test(v) || /^DI$/.test(compact)) return "Diploma";
      if (/^(DII|D2|D-2|D\.2)$/.test(v) || /^DII$/.test(compact)) return "Diploma";
      if (/^(DIII|D3|D-3|D\.3)$/.test(v) || /^DIII$/.test(compact)) return "Diploma";

      // D4/DIV treated as S1 (equivalency)
      if (/^(DIV|D4|D-4|D\.4)$/.test(v) || /^DIV$/.test(compact)) return "S1";

      // S1/S2/S3 with variants
      if (/^(S1|S-1|S\.1|SARJANA|STRATA1)$/.test(v) || /^S1$/.test(compact))
        return "S1";
      if (/^(S2|S-2|S\.2|MAGISTER|STRATA2)$/.test(v) || /^S2$/.test(compact))
        return "S2";
      if (/^(S3|S-3|S\.3|DOKTOR|STRATA3)$/.test(v) || /^S3$/.test(compact))
        return "S3";

      return null;
    };

    // Use fullTableData if available, otherwise fallback to stats.tableData
    const sourceData = fullTableData.length > 0 ? fullTableData : (stats?.tableData || []);

    if (!sourceData || sourceData.length === 0) {
      return {
        labels: Object.keys(buckets),
        values: Object.values(buckets),
        total: 0,
        rawTop: [],
        rowCount: 0,
      };
    }

    // Raw value counter for debugging/visibility
    const rawCounter = new Map<string, number>();

    for (const row of sourceData) {
      const raw = (row.pendidikan || "").toString().trim();
      if (raw) rawCounter.set(raw, (rawCounter.get(raw) || 0) + 1);

      const norm = normalize(raw);
      if (norm && buckets.hasOwnProperty(norm)) {
        buckets[norm] += 1;
      }
    }

    const labels = Object.keys(buckets);
    const values = labels.map((k) => buckets[k]);
    const total = values.reduce((a, b) => a + b, 0);

    const rawTop = Array.from(rawCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.debug("Pendidikan distribution", {
      buckets,
      total,
      rawTop,
      rows: sourceData.length,
    });

    return { labels, values, total, rawTop, rowCount: sourceData.length };
  })();

  useEffect(() => {
    fetchDaerahList();
    fetchAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedDaerah && selectedPeriod) {
      fetchDashboardData();
      fetchKompetensiData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDaerah, selectedPeriod]);







  // Load Kompetensi/Diklat/Dampak untuk daerah & periode terpilih (SPMT)
  const fetchKompetensiData = async () => {
    try {
      // Helper untuk reset field
      const resetFields = () => {
        setKompetensiId(null);
        setKompetensiIsi("");
        setDiklatId(null);
        setDiklatIsi("");
        setDampakId(null);
        setDampakIsi("");
      };

      // Validasi awal
      if (!selectedDaerah || selectedDaerah === "0" || !selectedPeriod) {
        resetFields();
        return;
      }

      const [monthPart, yearPart] = selectedPeriod.split("-");
      const year = /^\d{4}$/.test(yearPart) ? yearPart : null;
      const month = monthPart === "all" ? null : monthPart;

      if (!year) {
        console.warn("Periode tidak valid");
        resetFields();
        return;
      }

      // Query params
      const params = new URLSearchParams({ daerah_id: String(selectedDaerah) });
      if (year) params.append("year", year);
      if (month) params.append("month", month);

      // Fetch data
      const resp = await fetch(
        `/api/admin/spmt-kompetensi?${params.toString()}`
      );
      if (!resp.ok) {
        console.error("Fetch gagal:", resp.status);
        resetFields();
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
      console.error("Failed to fetch spmt-kompetensi", e);
    }
  };

  const saveKompetensi = async (jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK") => {
    try {
      if (!selectedDaerah || !selectedPeriod) return;

      if (selectedDaerah === "0") {
        alert(
          "Silakan pilih daerah spesifik untuk menyimpan kompetensi/diklat/dampak."
        );
        return;
      }

      const [monthPart, yearPart] = selectedPeriod.split("-");
      const yearNum = /^\d{4}$/.test(yearPart) ? parseInt(yearPart, 10) : NaN;
      const monthVal = monthPart === "all" ? null : monthPart;

      if (!yearNum || isNaN(yearNum)) {
        alert("Periode tidak valid. Silakan pilih periode yang benar.");
        return;
      }

      // Ambil isi sesuai jenis
      let isi =
        jenis === "KOMPETENSI"
          ? kompetensiIsi
          : jenis === "DIKLAT"
          ? diklatIsi
          : dampakIsi;

      isi = isi.trim();

      if (!isi) {
        console.warn("Isi kosong, batal menyimpan", { jenis });
        return;
      }

      setSavingJenis(jenis);

      const id =
        jenis === "KOMPETENSI"
          ? kompetensiId
          : jenis === "DIKLAT"
          ? diklatId
          : dampakId;

      let resp: Response;

      if (id) {
        // Update
        resp = await fetch(`/api/admin/spmt-kompetensi/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jenis, isi }),
        });
      } else {
        // Create
        const body = {
          daerah_id: selectedDaerah,
          month: monthVal,
          year: yearNum,
          jenis,
          isi,
        };
        resp = await fetch(`/api/admin/spmt-kompetensi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`${id ? "PUT" : "POST"} gagal:`, resp.status, errText);
        alert("Terjadi kesalahan saat menyimpan data.");
        return;
      }

      await fetchKompetensiData();
    } catch (e) {
      console.error("Failed to save spmt-kompetensi", e);
      alert("Gagal menyimpan data. Periksa koneksi atau hubungi admin.");
    } finally {
      setSavingJenis(null);
    }
  };

  const deleteKompetensi = async (
    jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK"
  ) => {
    try {
      const id =
        jenis === "KOMPETENSI"
          ? kompetensiId
          : jenis === "DIKLAT"
          ? diklatId
          : dampakId;
      if (!id) return;
      if (selectedDaerah === "0") return;
      await fetch(`/api/admin/spmt-kompetensi/${id}`, { method: "DELETE" });
      await fetchKompetensiData();
    } catch (e) {
      console.error("Failed to delete spmt-kompetensi", e);
    }
  };

  const fetchDaerahList = async () => {
    try {
      const response = await fetch("/api/admin/daerah");
      if (response.ok) {
        const data = await response.json();
        const list = (data.data || []) as Daerah[];

        // Tambahkan opsi StandAlone di paling atas
        const allOption: Daerah = {
          id: 0,
          nama: "Konsolidasi SPMT (Semua Branch)",
          kode: "StandAlone",
        };
        const withAll = [allOption, ...list];

        setDaerahList(withAll);
        // Default pilih StandAlone
        setSelectedDaerah(String(allOption.id)); // '0'
      }
    } catch (error) {
      console.error("Error fetching daerah list:", error);
    }
  };

  const fetchAvailablePeriods = async () => {
    try {
      const response = await fetch("/api/admin/available-months");
      const data = await response.json();

      if (data.periods && data.periods.length > 0) {
        setAvailablePeriods(data.periods);
        setSelectedPeriod(data.periods[0].value);
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      if (!selectedPeriod || !selectedDaerah) return;

      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? null : monthPart;
      const year = yearPart;

      const params = new URLSearchParams();
      if (month) params.append("month", month);
      params.append("year", year);

      // Hanya kirim daerah_id jika bukan ALL
      if (selectedDaerah && selectedDaerah !== "0") {
        params.append("daerah_id", selectedDaerah);
      }

      // Fetch larger slice for Pendidikan aggregation
      try {
        const bigParams = new URLSearchParams(params);
        bigParams.append("page", "1");
        bigParams.append("limit", "10000");

        const bigResp = await fetch(
          `/api/admin/spmt-table-data?${bigParams.toString()}`
        );
        if (bigResp.ok) {
          const bigJson = await bigResp.json();
          setFullTableData(bigJson.data || []);
        } else {
          setFullTableData([]);
        }
      } catch (err) {
        console.error("Error fetching big table data:", err);
        setFullTableData([]);
      }

      // Table params (dengan pagination)
      const tableParams = new URLSearchParams(params);
      tableParams.append("page", "1");
      tableParams.append("limit", "100");

      const tableResponse = await fetch(
        `/api/admin/spmt-table-data?${tableParams.toString()}`
      );
      const tableData = await tableResponse.json();

      const chartResponse = await fetch(
        `/api/admin/dashboard-stats?${params.toString()}`
      );
      const chartData = await chartResponse.json();

      // Fetch BOPO data
      const bopoParams = new URLSearchParams();
      if (selectedDaerah && selectedDaerah !== "0") {
        bopoParams.append("daerah_id", selectedDaerah);
      }
      if (month) bopoParams.append("bulan", month);
      bopoParams.append("tahun", year);

      const bopoResponse = await fetch(
        `/api/admin/bopo-spmt-dashboard?${bopoParams.toString()}`
      );
      const bopoResult = await bopoResponse.json();

      console.log("Table response:", tableData);
      console.log("Chart response:", chartData);
      console.log("BOPO response:", bopoResult);

      if (tableData.success && chartData.success) {
        console.log("Chart data received:", chartData.data);
        console.log(
          "Setting stats with totalEmployees:",
          chartData.data.totalEmployees || chartData.data.total || 0
        );

        // Set BOPO data if available
        let bopoData = null;
        if (
          bopoResult.success &&
          bopoResult.data &&
          bopoResult.data.length > 0
        ) {
          bopoData = bopoResult.data[0]; // Get the latest BOPO data
        }

        setStats({
          totalEmployees:
            chartData.data.totalEmployees || chartData.data.total || 0,
          tableData: tableData.data,
          chartData: chartData.data.chartData,
          bopoData: bopoData,
        });
      } else {
        console.error("API Error - Table:", tableData, "Chart:", chartData);
        setStats({
          totalEmployees: 0,
          tableData: [],
          chartData: {
            organik: 0,
            nonOrganik: 0,
            operasional: 0,
            nonOperasional: 0,
            lakiLaki: 0,
            perempuan: 0,
            organikOperasional: 0,
            organikNonOperasional: 0,
            nonOrganikOperasional: 0,
            nonOrganikNonOperasional: 0,
            total: 0,
          },
          bopoData: null,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      if (!selectedPeriod) return;
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const params = new URLSearchParams();
      if (monthPart && monthPart !== "all") params.append("month", monthPart);
      if (yearPart) params.append("year", yearPart);
      // Export all regions: do NOT include daerah_id
      params.append("export", "excel");
      const url = `/api/admin/spmt-table-data?${params.toString()}`;
      window.open(url, "_blank");
    } catch (e) {
      console.error("Failed to download Excel:", e);
    }
  };

  const handleExportPdf = () => {
    if (!regionalRef.current) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    try {
      setExporting(true);
      // Gunakan window.print() untuk format print browser seperti Google Chrome
      window.print();
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Gagal mengekspor ke PDF. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  const selectedDaerahInfo = daerahList.find(
    (d) => d.id.toString() === selectedDaerah
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading regional dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
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
      `}} />
      <div
        ref={regionalRef}
        className="dashboard-container min-h-screen bg-gray-100"
        id="regional-dashboard-print"
      >
        {/* Header */}
        <div className="bg-gradient-to-r text-black">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">
                DEMOGRAFI SDM - {selectedDaerahInfo?.nama || "Regional"}
              </h1>
              <p className="text-base lg:text-lg">
                PT PELINDO MULTI TERMINAL GRUP
              </p>
            </div>
            <br></br>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="bg-blue-500 px-3 sm:px-4 py-2 rounded w-full sm:w-auto">
                  <select
                    className="bg-transparent text-white border-none outline-none w-full sm:w-auto text-sm sm:text-base"
                    value={selectedDaerah}
                    onChange={(e) => setSelectedDaerah(e.target.value)}
                  >
                    {daerahList.map((daerah) => (
                      <option
                        key={daerah.id}
                        className="text-black"
                        value={daerah.id}
                      >
                        {daerah.nama} ({daerah.kode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-blue-500 px-3 sm:px-4 py-2 rounded w-full sm:w-auto">
                  <select
                    className="bg-transparent text-white border-none outline-none w-full sm:w-auto text-sm sm:text-base"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    {availablePeriods.map((period) => (
                      <option
                        key={period.value}
                        className="text-black"
                        value={period.value}
                      >
                        {period.label} ({period.totalRecords} data)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  data-export-ignore="true"
                  onClick={handleDownloadExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                >
                  <FiDownload className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Excel</span>
                </button>
                <button
                  data-export-ignore="true"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
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
                      <span className="hidden sm:inline">Mengekspor...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="hidden sm:inline">Export PDF</span>
                      <span className="sm:hidden">PDF</span>
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
            <div
              data-export-gradient="blueDeep"
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4"
            >
              <h2 className="text-lg font-bold text-center">
                KONSOLIDASI SPMT - {selectedDaerahInfo?.kode}
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
                      {stats.chartData.organik > 0 ||
                      stats.chartData.nonOrganik > 0 ? (
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
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          No Data
                        </div>
                      )}
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
                      {stats.chartData.nonOperasional > 0 ||
                      stats.chartData.operasional > 0 ? (
                        <Doughnut
                          data={{
                            labels: ["Non Operasional", "Operasional"],
                            datasets: [
                              {
                                data: [
                                  stats.chartData.nonOperasional || 0,
                                  stats.chartData.operasional || 0,
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
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          No Data
                        </div>
                      )}
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
                      {stats.chartData.perempuan > 0 ||
                      stats.chartData.lakiLaki > 0 ? (
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
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          No Data
                        </div>
                      )}
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
                          className="flex items-center justify-between bg-blue-400 text-white p-1 rounded"
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
                          <span>{pendidikanDistribution.values[idx]} org</span>
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
            <div
              data-export-gradient="blueDeep"
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4"
            >
              <h2 className="text-lg font-bold text-center">
                JUMLAH - {selectedDaerahInfo?.kode}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Pekerja */}
                <div
                  data-export-gradient="blueDeep"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {formatNumber(stats?.chartData.total ?? null)}
                    </div>
                    <div className="text-sm mt-2">JUMLAH PEKERJA</div>
                  </div>
                </div>

                {/* Produktivitas */}
                <div
                  data-export-gradient="blueDeep"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      Rp{" "}
                      {formatNumber(
                        stats?.bopoData?.produktivitas_efisiensi ?? null
                      )}
                    </div>
                    <div className="text-sm mt-2">PRODUKTIVITAS</div>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="space-y-3">
                  <div
                    data-export-gradient="blueDeep"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl"
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold">
                        {formatNumber(stats?.bopoData?.bopo_ratio ?? null)}%
                      </div>
                      <div className="text-xs">BOPO</div>
                    </div>
                  </div>
                  <div
                    data-export-gradient="blueDeep"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl"
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold">
                        {formatNumber(
                          stats?.bopoData?.rasio_beban_penghasilan_usaha ?? null
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
                  {selectedDaerah === "0" ? (
                    <div className="text-gray-500 text-sm text-center">
                      Pilih daerah spesifik untuk mengelola kompetensi.
                    </div>
                  ) : (
                    <div className="prose max-w-none text-sm whitespace-pre-wrap text-gray-800">
                      {kompetensiIsi?.trim() ? kompetensiIsi : "Belum ada data."}
                    </div>
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
                  {selectedDaerah === "0" ? (
                    <div className="text-gray-500 text-sm text-center">
                      Pilih daerah spesifik untuk mengelola kebutuhan diklat.
                    </div>
                  ) : (
                    <div className="prose max-w-none text-sm whitespace-pre-wrap text-gray-800">
                      {diklatIsi?.trim() ? diklatIsi : "Belum ada data."}
                    </div>
                  )}
                </div>
              </div>

              {/* Dampak */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-yellow-200 text-gray-800 px-6 py-3">
                  <h2 className="text-sm sm:text-base font-bold text-center">
                    DAMPAK TERHADAP BRANCH, APABILA KOMPETENSI TIDAK
                    TERPENUHI.
                  </h2>
                </div>
                <div className="p-6">
                  {selectedDaerah === "0" ? (
                    <div className="text-gray-500 text-sm text-center">
                      Pilih daerah spesifik untuk mengelola dampak.
                    </div>
                  ) : (
                    <div className="prose max-w-none text-sm whitespace-pre-wrap text-gray-800">
                      {dampakIsi?.trim() ? dampakIsi : "Belum ada data."}
                    </div>
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