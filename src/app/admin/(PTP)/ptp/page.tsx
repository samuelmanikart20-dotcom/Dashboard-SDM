"use client";

import { useState, useEffect, useRef } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import { FaTrash } from "react-icons/fa";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { FiDownload } from "react-icons/fi";
import { useAlert } from "@/utils/alert";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

// Consistent number formatter (match regional dashboard style)
const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "0";
  const n = Number(value);
  if (isNaN(n)) return "0";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
};

// Helper function to check if color is white or gray
const isWhiteOrGrayColor = (color: string): boolean => {
  if (!color) return true;
  const lowerColor = color.toLowerCase().trim();
  return (
    lowerColor === 'rgb(255, 255, 255)' ||
    lowerColor === 'white' ||
    lowerColor === '#ffffff' ||
    lowerColor === '#fff' ||
    lowerColor === 'rgb(128, 128, 128)' ||
    lowerColor === 'gray' ||
    lowerColor === 'grey' ||
    lowerColor === '#808080' ||
    lowerColor === 'rgb(156, 163, 175)' ||
    lowerColor === 'rgb(229, 231, 235)'
  );
};

// Helper function to normalize HTML color to black for elements without color
const normalizeColor = (html: string): string => {
  if (!html) return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const styleColor = htmlEl.style.color || '';
    const styleAttr = htmlEl.getAttribute('style') || '';
    
    const colorMatch = styleAttr.match(/color:\s*([^;]+)/i);
    const explicitColor = colorMatch ? colorMatch[1].trim() : '';
    
    const shouldSetBlack = !styleColor && !explicitColor || 
                           isWhiteOrGrayColor(styleColor) || 
                           isWhiteOrGrayColor(explicitColor);
    
    if (shouldSetBlack) {
      const currentStyle = htmlEl.getAttribute('style') || '';
      if (!currentStyle.includes('color:')) {
        htmlEl.setAttribute('style', (currentStyle ? currentStyle + ' ' : '') + 'color: #000000;');
      } else {
        htmlEl.setAttribute('style', currentStyle.replace(/color:\s*[^;]+/gi, 'color: #000000'));
      }
      htmlEl.style.color = '#000000';
    }
  });
  
  return tempDiv.innerHTML;
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
  const { alert, AlertComponent } = useAlert();
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
  const [isInherited, setIsInherited] = useState<{
    kompetensi: boolean;
    diklat: boolean;
    dampak: boolean;
  }>({
    kompetensi: false,
    diklat: false,
    dampak: false,
  });
  const [inheritedFromMonth, setInheritedFromMonth] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<{
    kompetensi: boolean;
    diklat: boolean;
    dampak: boolean;
  }>({
    kompetensi: false,
    diklat: false,
    dampak: false,
  });
  const [originalContent, setOriginalContent] = useState<{
    kompetensi: string;
    diklat: string;
    dampak: string;
  }>({
    kompetensi: "",
    diklat: "",
    dampak: "",
  });
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [deleteBulan, setDeleteBulan] = useState<string>('');
  const [deleteTahun, setDeleteTahun] = useState<string>('');
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    fetchUnitKerjaList();
    fetchAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      setCurrentPage(1);
      fetchDashboardData();
      fetchTableData();
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
      if (!response.ok) {
        throw new Error(
          `Failed to fetch available periods: ${response.status}`
        );
      }
      const data = await response.json();
      const periods = data.data || [];
      setAvailablePeriods(periods);
      if (periods.length > 0) {
        setSelectedPeriod(periods[0].value);
      } else {
        // No periods available -> initialize empty state and stop loading
        setSelectedPeriod("");
        setStats({
          totalEmployees: 0,
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
        });
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
      // Error fetching periods -> initialize empty state and stop loading
      setAvailablePeriods([]);
      setSelectedPeriod("");
      setStats({
        totalEmployees: 0,
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
      });
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Validate first to avoid turning on loading without proceeding
      if (!selectedPeriod) return;

      setLoading(true);

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
        const dataArray = bigData.data || [];
        setFullTableData(dataArray);
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

  // Compute Pendidikan distribution (real data) from fullTableData - DIRECTLY from pendidikan column
  const pendidikanDistribution = (() => {
    const buckets: Record<string, number> = {
      S3: 0,
      S2: 0,
      S1: 0,
      Diploma: 0,
      SMA: 0,
    };

    const normalize = (val: string): keyof typeof buckets | null => {
      if (!val) return null;
      
      const v = val.toString().trim().toUpperCase();
      if (!v || v === '' || v === 'NULL' || v === 'N/A') return null;
      
      // Remove spaces, dots, hyphens for matching
      const compact = v.replace(/\s+/g, "").replace(/[\.-]/g, "");
      
      // S3 (Doktor) - check first as it's most specific
      if (/^(S3|S-3|S\.3|DOKTOR|DR|STRATA3|STRATA\s*3)$/.test(v) || 
          /^S3$/.test(compact) || 
          v.includes('DOKTOR') || 
          v.includes('S3')) {
        return "S3";
      }
      
      // S2 (Magister)
      if (/^(S2|S-2|S\.2|MAGISTER|MAG|STRATA2|STRATA\s*2|MASTER)$/.test(v) || 
          /^S2$/.test(compact) || 
          v.includes('MAGISTER') || 
          v.includes('S2')) {
        return "S2";
      }
      
      // S1 (Sarjana)
      if (/^(S1|S-1|S\.1|SARJANA|STRATA1|STRATA\s*1|BAKALAUREAT)$/.test(v) || 
          /^S1$/.test(compact) || 
          v.includes('SARJANA') || 
          v.includes('S1')) {
        return "S1";
      }
      
      // D4/DIV treated as S1
      if (/^(DIV|D4|D-4|D\.4|D\s*IV)$/.test(v) || 
          /^DIV$/.test(compact) || 
          v.includes('D4') || 
          v.includes('DIV')) {
        return "S1";
      }
      
      // Diploma family (D1, D2, D3)
      if (/^(DIII|D3|D-3|D\.3|D\s*III|DIPLOMA\s*3)$/.test(v) || 
          /^DIII$/.test(compact) || 
          v.includes('D3') || 
          (v.includes('DIPLOMA') && v.includes('3'))) {
        return "Diploma";
      }
      if (/^(DII|D2|D-2|D\.2|D\s*II|DIPLOMA\s*2)$/.test(v) || 
          /^DII$/.test(compact) || 
          v.includes('D2') || 
          (v.includes('DIPLOMA') && v.includes('2'))) {
        return "Diploma";
      }
      if (/^(DI|D1|D-1|D\.1|D\s*I|DIPLOMA\s*1)$/.test(v) || 
          /^DI$/.test(compact) || 
          v.includes('D1') || 
          (v.includes('DIPLOMA') && !v.includes('2') && !v.includes('3'))) {
        return "Diploma";
      }
      // Generic "DIPLOMA" without number
      if (/^DIPLOMA$/.test(v) || v === 'D') {
        return "Diploma";
      }
      
      // SMA family (SMA, SMK, SMU, SLTA, SMP, SD)
      // Handle "SMU/SMK" format (with slash)
      if (v.includes('SMU') || v.includes('SMK') || v.includes('SMU/SMK') || v.includes('SMK/SMU')) {
        return "SMA";
      }
      if (/(SMA|SMU|SLTA|SMP|SD|SLTP|SLTA|SEKOLAH\s*MENENGAH)/.test(v)) {
        return "SMA";
      }
      
      // Handle single letter codes that might be used
      // "L" might mean "Lainnya" or could be a typo, but we'll map common single letters
      if (v === 'L' || v === 'LAINNYA' || v === 'LAIN') {
        // Could be "Lainnya" - map to SMA as default
        return "SMA";
      }
      
      // Handle numeric-only values that might represent education codes
      if (/^\d+$/.test(v)) {
        // If it's just a number, might be a code - skip for now
        return null;
      }
      
      // If value exists but doesn't match any pattern, return null (will be logged in processing)
      return null;
    };

    // Use fullTableData if available (for accurate aggregation), otherwise use tableData
    const source = fullTableData.length > 0 ? fullTableData : tableData;
    
    if (!source || source.length === 0) {
      return {
        labels: Object.keys(buckets),
        values: Object.values(buckets),
        total: 0,
      };
    }
    
    // Process each row and normalize pendidikan value
    for (const row of source) {
      // Get pendidikan directly from row
      const pendidikanValue = row.pendidikan || '';
      
      if (!pendidikanValue || pendidikanValue.toString().trim() === '') {
        continue; // Skip rows without pendidikan
      }
      
      const norm = normalize(pendidikanValue.toString());
      if (norm && buckets.hasOwnProperty(norm)) {
        buckets[norm] += 1;
      }
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

  const handleExportPDF = () => {
    if (!dashboardRef.current) {
      alert("Tidak ada data untuk diekspor");
      return;
    }

    try {
      setExportingPDF(true);
      // Gunakan window.print() untuk format print browser seperti Google Chrome
      window.print();
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Gagal mengekspor ke PDF. Silakan coba lagi.");
    } finally {
      setExportingPDF(false);
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
        setIsInherited({ kompetensi: false, diklat: false, dampak: false });
        setInheritedFromMonth(null);
        return;
      }
      const [month, year] = selectedPeriod.split("-");
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
        setIsInherited({ kompetensi: false, diklat: false, dampak: false });
        setInheritedFromMonth(null);
        return;
      }
      const json = await resp.json();
      const rows: any[] = json.data || [];
      
      const byJenis = (jenis: string) => rows.find((r) => r.jenis === jenis);
      const k = byJenis("KOMPETENSI");
      const d = byJenis("DIKLAT");
      const p = byJenis("DAMPAK");
      
      // Set inherited flags terlebih dahulu
      const kompetensiInherited = k?.is_inherited === true;
      const diklatInherited = d?.is_inherited === true;
      const dampakInherited = p?.is_inherited === true;
      
      setIsInherited({
        kompetensi: kompetensiInherited,
        diklat: diklatInherited,
        dampak: dampakInherited,
      });
      setInheritedFromMonth(json.inherited_from_month || null);
      
      // Set data - jika inherited, set ID ke null agar saat save membuat record baru
      setKompetensiId(kompetensiInherited ? null : (k?.id ?? null));
      
      const kompetensiIsiValue = normalizeColor(k?.isi ?? "");
      const diklatIsiValue = normalizeColor(d?.isi ?? "");
      const dampakIsiValue = normalizeColor(p?.isi ?? "");
      
      setKompetensiIsi(kompetensiIsiValue);
      setDiklatId(diklatInherited ? null : (d?.id ?? null));
      setDiklatIsi(diklatIsiValue);
      setDampakId(dampakInherited ? null : (p?.id ?? null));
      setDampakIsi(dampakIsiValue);
      
      // Reset mode edit saat data berubah
      setIsEditing({
        kompetensi: false,
        diklat: false,
        dampak: false,
      });
    } catch (e) {
      console.error("Failed to fetch ptp-kompetensi", e);
    }
  };

  const handleEdit = (jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK") => {
    const currentContent =
      jenis === "KOMPETENSI"
        ? kompetensiIsi
        : jenis === "DIKLAT"
        ? diklatIsi
        : dampakIsi;
    
    // Simpan konten asli
    setOriginalContent((prev) => ({
      ...prev,
      [jenis.toLowerCase()]: currentContent,
    }));
    
    // Aktifkan mode edit
    setIsEditing((prev) => ({
      ...prev,
      [jenis.toLowerCase()]: true,
    }));
  };

  const handleCancelEdit = (jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK") => {
    // Kembalikan konten ke original
    const original =
      jenis === "KOMPETENSI"
        ? originalContent.kompetensi
        : jenis === "DIKLAT"
        ? originalContent.diklat
        : originalContent.dampak;
    
    if (jenis === "KOMPETENSI") {
      setKompetensiIsi(original);
    } else if (jenis === "DIKLAT") {
      setDiklatIsi(original);
    } else {
      setDampakIsi(original);
    }
    
    // Nonaktifkan mode edit
    setIsEditing((prev) => ({
      ...prev,
      [jenis.toLowerCase()]: false,
    }));
  };

  const saveKompetensi = async (jenis: "KOMPETENSI" | "DIKLAT" | "DAMPAK") => {
    try {
      const selectedUnit = unitKerjaList.find(
        (u) => u.id === selectedUnitKerja
      );
      if (!selectedUnit?.ptp_daerah_id || !selectedPeriod) return;
      const [month, year] = selectedPeriod.split("-");
      setSavingJenis(jenis);
      let isi =
        jenis === "KOMPETENSI"
          ? kompetensiIsi
          : jenis === "DIKLAT"
          ? diklatIsi
          : dampakIsi;
      
      // Trim isi
      const trimmedIsi = isi.trim();
      if (!trimmedIsi) {
        setSavingJenis(null);
        return;
      }
      
      // Normalize color untuk memastikan semua elemen punya color hitam jika tidak ada color
      isi = normalizeColor(trimmedIsi);
      
      // Jika root element tidak punya children, wrap dengan div yang punya color
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = isi;
      if (tempDiv.children.length === 0 && !tempDiv.style.color) {
        const textContent = tempDiv.textContent || '';
        if (textContent.trim()) {
          isi = `<div style="color: #000000;">${trimmedIsi}</div>`;
        }
      }
      
      const id =
        jenis === "KOMPETENSI"
          ? kompetensiId
          : jenis === "DIKLAT"
          ? diklatId
          : dampakId;

      // Jika data inherited (dari bulan sebelumnya), selalu buat record baru untuk bulan ini
      const isInheritedData = jenis === "KOMPETENSI" 
        ? isInherited.kompetensi 
        : jenis === "DIKLAT" 
        ? isInherited.diklat 
        : isInherited.dampak;

      let response;
      if (id && !isInheritedData) {
        // Update data yang sudah ada (bukan inherited)
        response = await fetch(`/api/admin/ptp-kompetensi/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jenis, isi }),
        });
      } else {
        // Create baru (baik untuk data baru maupun data inherited yang diedit)
        response = await fetch(`/api/admin/ptp-kompetensi`, {
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error saving kompetensi data:', errorText);
      }
      
      await fetchKompetensiData();
      
      // Nonaktifkan mode edit setelah fetch data selesai
      // Tunggu sebentar untuk memastikan data sudah ter-update
      setTimeout(() => {
        setIsEditing((prev) => ({
          ...prev,
          [jenis.toLowerCase()]: false,
        }));
      }, 100);
    } catch (e) {
      console.error("Failed to save ptp-kompetensi", e);
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
      await fetch(`/api/admin/ptp-kompetensi/${id}`, { method: "DELETE" });
      await fetchKompetensiData();
    } catch (e) {
      console.error("Failed to delete ptp-kompetensi", e);
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

  const handleDeleteData = async () => {
    if (!deleteBulan || !deleteTahun) {
      alert('Silakan pilih bulan dan tahun terlebih dahulu');
      return;
    }

    const bulanInt = parseInt(deleteBulan);
    const tahunInt = parseInt(deleteTahun);

    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      alert('Bulan tidak valid');
      return;
    }

    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      alert('Tahun tidak valid');
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const confirmDeleteData = async () => {
    if (!deleteBulan || !deleteTahun) {
      return;
    }

    const bulanInt = parseInt(deleteBulan);
    const tahunInt = parseInt(deleteTahun);

    setShowConfirmModal(false);
    setDeleting(true);

    try {
      const response = await fetch(`/api/admin/ptp-data?bulan=${bulanInt}&tahun=${tahunInt}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        const bulanName = getBulanName();
        const tahunValue = deleteTahun;
        
        // Reset form first
        setDeleteBulan('');
        setDeleteTahun('');
        
        // Show success alert
        alert(`Berhasil menghapus ${data.deletedCount || 0} data PTP untuk bulan ${bulanName} ${tahunValue}`, 'success');
        
        // Refresh data after deletion
        await fetchAvailablePeriods();
        setTimeout(() => {
          fetchDashboardData();
          fetchTableData();
        }, 300);
      } else {
        alert(data.error || 'Gagal menghapus data PTP', 'error');
      }
    } catch (error) {
      console.error('Error deleting PTP data:', error);
      alert('Terjadi kesalahan saat menghapus data PTP', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getBulanName = () => {
    if (!deleteBulan) return '';
    const bulanInt = parseInt(deleteBulan);
    const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulanNames[bulanInt - 1] || '';
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading PTP Dashboard...</p>
        </div>
      </div>
    );
  }

  // If not loading and no available periods, show an empty state instead of spinner
  if (!loading && availablePeriods.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 text-2xl">ℹ️</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Tidak ada data periode tersedia
          </h2>
          <p className="text-gray-600 mb-4">
            Silakan unggah data PTP terlebih dahulu atau pilih periode lain.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fetchAvailablePeriods()}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Muat Ulang Periode
            </button>
          </div>
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
          .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
          .dashboard-container div[class*="bg-gradient-to-r"],
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
        .h-16:first-of-type:not([class*="bg-gradient"]):not([class*="text-black"]),
        div[style*="height: 4rem"]:not([class*="bg-gradient"]):not([class*="text-black"]) {
          display: none !important;
        }
        
        /* Pindahkan konten ke kanan saat print */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div {
          justify-content: flex-end !important;
          text-align: right !important;
        }
        
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:first-child {
          text-align: right !important;
        }
        
        /* PASTIKAN header dashboard TIDAK terkena aturan di atas */
        .dashboard-container > div[class*="bg-gradient-to-r"],
        .dashboard-container > div[class*="bg-gradient-to-r"] * {
          display: block !important;
          visibility: visible !important;
        }
        
        /* Sembunyikan container tombol-tombol dan dropdown */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:last-child,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div.flex:last-child {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
        }
        
        /* Sembunyikan tombol-tombol export dan dropdown */
        button[onclick*="handleExportPDF"],
        button[onclick*="handleDownloadExcel"],
        button[onclick*="handleExportStrukturPDF"],
        button[onclick*="handleExportPdf"],
        button:has(svg[width="10"]),
        button:has(svg[width="12"]),
        button:has(.h-2\.5),
        button:has(.h-3),
        button:has(.h-4),
        select,
        div[class*="bg-blue-500"]:has(select) {
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
        
        /* Pastikan hanya div pertama (yang berisi h1 dan p) yang muncul */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:first-child {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
        }
        
        /* Sembunyikan sidebar berdasarkan parent container - jangan sembunyikan header dashboard */
        div.flex > div:first-child:not([class*="flex-1"]):not([class*="bg-gradient"]):not([class*="text-black"]) {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* PASTIKAN header dashboard TIDAK terkena aturan di atas */
          .dashboard-container > div[class*="bg-gradient-to-r"],
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
        a[href*="admin"],
        a[href*="ptp"] {
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
          .dashboard-container > div[class*="bg-gradient-to-r"],
          .dashboard-container div[class*="bg-gradient-to-r"][class*="text-black"],
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
          .dashboard-container > div[class*="bg-gradient-to-r"] p,
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
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
          .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
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
        
        /* Penanda Daerah di PDF Export - Hanya muncul di halaman pertama */
        .pdf-region-marker,
        div[class*="pdf-region-marker"],
        div.pdf-region-marker {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          background-color: #facc15 !important;
          border-bottom: 4px solid #000000 !important;
          z-index: 10 !important;
          padding: 12px 16px !important;
          margin-bottom: 16px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          font-weight: bold !important;
          text-align: center !important;
          color: #000000 !important;
          font-size: 24px !important;
          page-break-after: avoid !important;
        }
        
        /* Pastikan penanda tidak tersembunyi saat print */
        .hidden.print\\:block,
        .pdf-region-marker.hidden {
          display: block !important;
          visibility: visible !important;
        }
      }
    `,
        }}
      />
      <div
        ref={dashboardRef}
        className="dashboard-container min-h-screen bg-gray-100"
      >
        {/* Penanda Daerah untuk PDF Export - Hanya muncul di halaman pertama saat print */}
        <div className="pdf-region-marker hidden print:block print:relative print:bg-yellow-400 print:border-b-4 print:border-black print:z-50 print:py-3 print:px-4 print:text-center print:font-bold print:text-black print:text-2xl print:mb-4">
          UNIT KERJA : {selectedUnitKerjaInfo?.kode || "StandAlone"} -{" "}
          {selectedUnitKerjaInfo?.nama || "Semua Branch"}
        </div>

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
            <br></br>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="bg-blue-500 px-3 sm:px-4 py-2 rounded w-full sm:w-auto">
                  <select
                    className="bg-transparent text-white border-none outline-none w-full sm:w-auto text-sm sm:text-base"
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
                <div className="bg-blue-500 px-3 sm:px-4 py-2 rounded w-full sm:w-auto">
                  <select
                    className="bg-transparent text-white border-none outline-none w-full sm:w-auto text-sm sm:text-base"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    {(() => {
                      // Group periods by year
                      const periodsByYear = new Map<number, Period[]>();
                      availablePeriods.forEach(period => {
                        const year = period.tahun;
                        if (!periodsByYear.has(year)) {
                          periodsByYear.set(year, []);
                        }
                        periodsByYear.get(year)!.push(period);
                      });

                      // Sort years descending
                      const sortedYears = Array.from(periodsByYear.keys()).sort((a, b) => b - a);

                      return sortedYears.map(year => {
                        const yearPeriods = periodsByYear.get(year)!;
                        const monthPeriods = yearPeriods.filter(p => p.type === 'month').sort((a, b) => {
                          const bulanA = typeof a.bulan === 'number' ? a.bulan : 0;
                          const bulanB = typeof b.bulan === 'number' ? b.bulan : 0;
                          return bulanB - bulanA; // Descending
                        });

                        return (
                          <optgroup key={year} label={`Tahun ${year}`} className="font-bold">
                            {monthPeriods.map(period => (
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
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                >
                  {exportingPDF ? (
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
                    {isInherited.kompetensi && inheritedFromMonth && (
                      <p className="text-xs text-center mt-1 text-gray-600">
                        Data dari bulan {inheritedFromMonth} (dapat diedit)
                      </p>
                    )}
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk mengelola kompetensi.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(!kompetensiId && !isInherited.kompetensi) || isEditing.kompetensi ? (
                          <>
                            <RichTextEditor
                          value={kompetensiIsi}
                              onChange={setKompetensiIsi}
                              placeholder="Tulis daftar kompetensi/pengetahuan aplikasi..."
                              rows={6}
                        />
                        <div className="flex gap-2 justify-end">
                              {isEditing.kompetensi && (
                                <button
                                  onClick={() => handleCancelEdit("KOMPETENSI")}
                                  className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                  Batal
                                </button>
                              )}
                              {kompetensiId && !isInherited.kompetensi && (
                            <button
                              onClick={() => deleteKompetensi("KOMPETENSI")}
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
                          </>
                        ) : (
                          <>
                            <div
                              className="border border-gray-300 rounded-lg p-4 min-h-[150px] bg-gray-50"
                              style={{ color: '#000000' }}
                              dangerouslySetInnerHTML={{
                                __html: kompetensiIsi || "<p class='text-gray-400 italic'>Belum ada data kompetensi</p>",
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleEdit("KOMPETENSI")}
                                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </button>
                      </div>
                          </>
                        )}
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
                    {isInherited.diklat && inheritedFromMonth && (
                      <p className="text-xs text-center mt-1 text-gray-600">
                        Data dari bulan {inheritedFromMonth} (dapat diedit)
                      </p>
                    )}
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk mengelola diklat.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(!diklatId && !isInherited.diklat) || isEditing.diklat ? (
                          <>
                            <RichTextEditor
                          value={diklatIsi}
                              onChange={setDiklatIsi}
                              placeholder="Tuliskan kebutuhan diklat/pengembangan SDM..."
                              rows={4}
                        />
                        <div className="flex gap-2 justify-end">
                              {isEditing.diklat && (
                                <button
                                  onClick={() => handleCancelEdit("DIKLAT")}
                                  className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                  Batal
                                </button>
                              )}
                              {diklatId && !isInherited.diklat && (
                            <button
                              onClick={() => deleteKompetensi("DIKLAT")}
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
                          </>
                        ) : (
                          <>
                            <div
                              className="border border-gray-300 rounded-lg p-4 min-h-[100px] bg-gray-50"
                              style={{ color: 'inherit' }}
                              dangerouslySetInnerHTML={{
                                __html: diklatIsi || "<p class='text-gray-400 italic'>Belum ada data diklat</p>",
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleEdit("DIKLAT")}
                                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </button>
                      </div>
                          </>
                        )}
                      </div>
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
                    {isInherited.dampak && inheritedFromMonth && (
                      <p className="text-xs text-center mt-1 text-gray-600">
                        Data dari bulan {inheritedFromMonth} (dapat diedit)
                      </p>
                    )}
                  </div>
                  <div className="p-6">
                    {selectedUnitKerja === "all" ? (
                      <div className="text-gray-500 text-sm text-center">
                        Silakan pilih daerah spesifik untuk mengelola dampak.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(!dampakId && !isInherited.dampak) || isEditing.dampak ? (
                          <>
                            <RichTextEditor
                          value={dampakIsi}
                              onChange={setDampakIsi}
                              placeholder="Tuliskan dampak terhadap branch jika kompetensi tidak terpenuhi..."
                              rows={4}
                        />
                        <div className="flex gap-2 justify-end">
                              {isEditing.dampak && (
                                <button
                                  onClick={() => handleCancelEdit("DAMPAK")}
                                  className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                  Batal
                                </button>
                              )}
                              {dampakId && !isInherited.dampak && (
                            <button
                              onClick={() => deleteKompetensi("DAMPAK")}
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
                          </>
                        ) : (
                          <>
                            <div
                              className="border border-gray-300 rounded-lg p-4 min-h-[100px] bg-gray-50"
                              style={{ color: '#000000' }}
                              dangerouslySetInnerHTML={{
                                __html: dampakIsi || "<p class='text-gray-400 italic'>Belum ada data dampak</p>",
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleEdit("DAMPAK")}
                                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </button>
                      </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hapus Data PTP Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Hapus Data PTP per Bulan
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Pilih bulan dan tahun untuk menghapus data PTP dari sistem. Tindakan ini tidak dapat dibatalkan.
            </p>
            
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bulan
                  </label>
                  <select
                    value={deleteBulan}
                    onChange={(e) => setDeleteBulan(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Pilih Bulan</option>
                    <option value="1">Januari</option>
                    <option value="2">Februari</option>
                    <option value="3">Maret</option>
                    <option value="4">April</option>
                    <option value="5">Mei</option>
                    <option value="6">Juni</option>
                    <option value="7">Juli</option>
                    <option value="8">Agustus</option>
                    <option value="9">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Desember</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tahun
                  </label>
                  <input
                    type="number"
                    value={deleteTahun}
                    onChange={(e) => setDeleteTahun(e.target.value)}
                    placeholder="Contoh: 2024"
                    min="2000"
                    max="2100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleDeleteData}
                  disabled={!deleteBulan || !deleteTahun || deleting}
                  className={`px-6 py-3 rounded-md font-medium transition-colors ${
                    !deleteBulan || !deleteTahun || deleting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {deleting ? 'Menghapus...' : 'Hapus Data PTP'}
                </button>
              </div>
            </div>
          </div>

          {/* Confirmation Modal */}
          {showConfirmModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none overflow-y-auto">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setShowConfirmModal(false)} />
              <div className="relative mx-auto p-6 w-full max-w-md shadow-xl rounded-lg bg-white pointer-events-auto">
                <div className="text-center">
                  {/* Icon */}
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100">
                    <FaTrash className="h-6 w-6 text-red-600" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mt-4">
                    Hapus Data PTP
                  </h3>

                  {/* Message */}
                  <div className="mt-3 px-4">
                    <p className="text-sm text-gray-600">
                      Apakah Anda yakin ingin <span className="font-medium text-red-600">menghapus</span> semua data PTP untuk bulan <span className="font-medium">{getBulanName()}</span> <span className="font-medium">{deleteTahun}</span>?<br />Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={confirmDeleteData}
                      className="flex-1 px-4 py-2 rounded-md text-white font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 bg-red-500 hover:bg-red-600 focus:ring-red-300"
                    >
                      Hapus
                    </button>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-300 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AlertComponent />
    </>
  );
}
