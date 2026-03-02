"use client";

import { useState, useEffect, useRef } from "react";
import { FaTrash } from "react-icons/fa";
import { FiDownload } from "react-icons/fi";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import RichTextEditor from "@/components/RichTextEditor";
import { useAlert } from "@/utils/alert";
import { OrgItem } from "@/components/OrgChart";

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

// setelah interface Period
interface OrgPositionNode {
  id: number;
  daerah_id: number;
  id_posisi_sap: string;
  id_posisi_atasan: string | null;
  nama_posisi: string | null;
  nama_jabatan_sap: string | null;
  unit_kerja: string | null;
  nipp: string | null;
  nama: string | null;
  tingkatan: string | null;
  direktorat: string | null;
  photo_url: string | null;
}
type OrgTreeNode = OrgPositionNode & { children: OrgTreeNode[] };

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
  const { alert, AlertComponent } = useAlert();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [daerahList, setDaerahList] = useState<Daerah[]>([]);
  const [selectedDaerah, setSelectedDaerah] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [orgNodes, setOrgNodes] = useState<OrgPositionNode[]>([]);
  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([]);
  const [, setOrgLoading] = useState<boolean>(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
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
  const [, setExportingStrukturPDF] =
    useState<boolean>(false);
  const [fullTableData, setFullTableData] = useState<TableData[]>([]);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const strukturOrgRef = useRef<HTMLDivElement>(null);
  const [deleteBulan, setDeleteBulan] = useState<string>('');
  const [deleteTahun, setDeleteTahun] = useState<string>('');
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

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
      if (/^(DI|D1|D-1|D\.1)$/.test(v) || /^DI$/.test(compact))
        return "Diploma";
      if (/^(DII|D2|D-2|D\.2)$/.test(v) || /^DII$/.test(compact))
        return "Diploma";
      if (/^(DIII|D3|D-3|D\.3)$/.test(v) || /^DIII$/.test(compact))
        return "Diploma";

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


    return { labels, values, total, rawTop, rowCount: sourceData.length };
  })();

  useEffect(() => {
    // Read query params for URL params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlDaerahId = params.get("daerah_id");
      const urlPeriod = params.get("period");

      if (urlDaerahId || urlPeriod) {
        if (urlDaerahId !== null) {
          setSelectedDaerah(urlDaerahId);
        }
        if (urlPeriod) {
          setSelectedPeriod(urlPeriod);
        }
      }
    }

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

  useEffect(() => {
    if (selectedDaerah && selectedDaerah !== "0") {
      fetchOrgPositions(selectedDaerah);
    } else {
      setOrgNodes([]);
      setOrgTree([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDaerah]);

  // Expand semua root secara default ketika orgTree berubah
  useEffect(() => {
    const next = new Set<string>();
    for (const root of orgTree) {
      const key = (root.id_posisi_sap || "").trim();
      if (key) next.add(key);
    }
    setExpandedKeys(next);
  }, [orgTree]);

  const toggleExpand = (sapKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(sapKey)) next.delete(sapKey);
      else next.add(sapKey);
      return next;
    });
  };

  const fetchOrgPositions = async (daerahId: string) => {
    try {
      setOrgLoading(true);
      const resp = await fetch(
        `/api/admin/org-positions?daerah_id=${daerahId}`
      );
      const json = await resp.json();
      const rows: OrgPositionNode[] = json?.data || [];
      setOrgNodes(rows);
      setOrgTree(buildOrgTree(rows));
    } catch (e) {
      console.error("Failed to fetch org positions", e);
      setOrgNodes([]);
      setOrgTree([]);
    } finally {
      setOrgLoading(false);
    }
  };

  const buildOrgTree = (nodes: OrgPositionNode[]): OrgTreeNode[] => {
    // Map key pakai id_posisi_sap yang sudah di-trim
    const byId = new Map<string, OrgTreeNode>();
    const childrenMap = new Map<string, OrgTreeNode[]>();

    // 1) Index semua node dengan key yang sudah di-trim
    for (const n of nodes) {
      const sapKey = (n.id_posisi_sap || "").trim();
      byId.set(sapKey, { ...n, children: [] });
    }

    // 2) Kumpulkan children berdasarkan parent (keduanya di-trim)
    for (const n of nodes) {
      const childKey = (n.id_posisi_sap || "").trim();
      const pid = (n.id_posisi_atasan || "").trim();

      if (pid && byId.has(pid)) {
        const list = childrenMap.get(pid) || [];
        // selalu ambil dari byId menggunakan childKey yang di-trim
        const childNode = byId.get(childKey);
        if (childNode) {
          list.push(childNode);
          childrenMap.set(pid, list);
        }
      }
    }

    // 3) Set children ke parent dan sort
    for (const [pid, childs] of childrenMap.entries()) {
      const p = byId.get(pid);
      if (p)
        p.children = childs.sort((a, b) =>
          (a.nama_posisi || "").localeCompare(b.nama_posisi || "")
        );
    }

    // 4) Tentukan roots: node tanpa parent yang valid
    const roots: OrgTreeNode[] = [];
    for (const n of nodes) {
      const childKey = (n.id_posisi_sap || "").trim();
      const pid = (n.id_posisi_atasan || "").trim();
      if (!pid || !byId.has(pid)) {
        const node = byId.get(childKey);
        if (node) roots.push(node);
      }
    }

    // Sort root untuk tampilan rapi
    roots.sort(
      (a, b) =>
        (a.tingkatan || "").localeCompare(b.tingkatan || "") ||
        (a.nama_posisi || "").localeCompare(b.nama_posisi || "")
    );
    return roots;
  };

  const mapToOrgItems = (nodes: OrgPositionNode[]): OrgItem[] => {
    // pakai id yang sudah di-trim agar konsisten
    const clean = (v?: string | null) =>
      (v || "").toString().trim() || undefined;

    // Untuk stabilitas: filter node yang punya id_posisi_sap valid
    const valid = nodes.filter((n) => clean(n.id_posisi_sap));

    // Opsional: beri warna badge per tingkatan/direktorat
    const pickBadge = (n: OrgPositionNode) => {
      const t = (n.tingkatan || "").toUpperCase();
      if (t.includes("DIREKTUR")) return "#8B5CF6";
      if (t.includes("MANAJER") || t.includes("MANAGER")) return "#10B981";
      if (t.includes("SUPERVISOR")) return "#F59E0B";
      return "#1E40AF";
    };

    const items: OrgItem[] = valid.map((n) => ({
      id: clean(n.id_posisi_sap)!,
      parentId: clean(n.id_posisi_atasan) || null,
      label:
        clean(n.nama) ||
        clean(n.nama_posisi) ||
        clean(n.nama_jabatan_sap) ||
        "-",
      subtitle: clean(n.nama_posisi) || clean(n.nama_jabatan_sap),
      photoUrl: clean(n.photo_url),
      positionTitle: clean(n.nama_posisi) || clean(n.nama_jabatan_sap),
      unit: clean(n.unit_kerja),
      nipp: clean(n.nipp),
      badgeColor: pickBadge(n),
    }));

    return items;
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const orgItems: OrgItem[] = mapToOrgItems(orgNodes);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderOrgNode = (node: OrgTreeNode, depth = 0) => {
    const sapKey = (node.id_posisi_sap || "").trim();
    const isExpanded = expandedKeys.has(sapKey);

    return (
      <div key={`${node.id}_${sapKey}`} className="py-1">
        <div
          className="flex items-start gap-3 p-2 rounded border border-gray-200 bg-white"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {/* Chevron */}
          <button
            type="button"
            onClick={() =>
              node.children?.length ? toggleExpand(sapKey) : undefined
            }
            className={`mt-1 w-5 h-5 flex items-center justify-center rounded ${
              node.children?.length
                ? "text-gray-600 hover:bg-gray-100"
                : "text-gray-300 cursor-default"
            }`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {node.children?.length ? (
              <span
                className="inline-block transition-transform"
                style={{ transform: `rotate(${isExpanded ? 90 : 0}deg)` }}
              >
                ▶
              </span>
            ) : (
              <span className="inline-block opacity-40">•</span>
            )}
          </button>

          {/* Avatar */}
          {node.photo_url ? (
            <img
              src={node.photo_url}
              alt={node.nama || node.nama_posisi || "Foto"}
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.src = "/icon.jpeg"; // fallback lokal
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
              N/A
            </div>
          )}

          {/* Teks */}
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-800">
              {node.nama_posisi || node.nama_jabatan_sap || "-"}
            </div>
            <div className="text-xs text-gray-600">
              {node.nama ? `${node.nama}` : "-"}
              {node.nipp ? ` • ${node.nipp}` : ""}
            </div>
            {node.direktorat && (
              <div className="text-xs inline-block bg-yellow-200 text-gray-800 px-1 rounded">
                {node.direktorat}
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && node.children?.length > 0 && (
          <div className="mt-1 border-l border-gray-200 ml-4">
            {node.children.map((c) => (
              <div key={(c.id_posisi_sap || "").trim()} className="pl-4">
                {renderOrgNode(c, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Kelompokkan nodes per direktorat
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groupByDirektorat = (nodes: OrgPositionNode[]) => {
    const groups = new Map<string, OrgPositionNode[]>();
    for (const n of nodes) {
      const dir = (n.direktorat || "").toString().trim() || "Tanpa Direktorat";
      const arr = groups.get(dir) || [];
      arr.push(n);
      groups.set(dir, arr);
    }
    return groups;
  };

  // Pemetaan nodes -> OrgItem[] untuk satu grup direktorat saja
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toOrgItemsForGroup = (nodes: OrgPositionNode[]): OrgItem[] => {
    const clean = (v?: string | null) =>
      (v || "").toString().trim() || undefined;

    // Valid id di grup
    const idSet = new Set<string>();
    for (const n of nodes) {
      const id = clean(n.id_posisi_sap);
      if (id) idSet.add(id);
    }

    // Badge warna opsional
    const pickBadge = (n: OrgPositionNode) => {
      const t = (n.tingkatan || "").toUpperCase();
      if (t.includes("DIREKTUR")) return "#8B5CF6";
      if (t.includes("MANAJER") || t.includes("MANAGER")) return "#10B981";
      if (t.includes("SUPERVISOR")) return "#F59E0B";
      return "#1E40AF";
    };

    const items: OrgItem[] = [];
    for (const n of nodes) {
      const id = clean(n.id_posisi_sap);
      if (!id) continue;

      // Parent tetap di-grup yang sama; jika tidak ada/beda grup -> root (null)
      const parentRaw = clean(n.id_posisi_atasan);
      const parentId = parentRaw && idSet.has(parentRaw) ? parentRaw : null;

      items.push({
        id,
        parentId,
        label:
          clean(n.nama) ||
          clean(n.nama_posisi) ||
          clean(n.nama_jabatan_sap) ||
          "-",
        subtitle: clean(n.nama_posisi) || clean(n.nama_jabatan_sap),
        photoUrl: clean(n.photo_url),
        positionTitle: clean(n.nama_posisi) || clean(n.nama_jabatan_sap),
        unit: clean(n.unit_kerja),
        nipp: clean(n.nipp),
        badgeColor: pickBadge(n),
      });
    }
    return items;
  };

  // Urutan direktorat mengikuti kemunculan pertama (urutan DB/upload)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const directorateOrder = (() => {
    const order = new Map<string, number>();
    orgNodes.forEach((n, idx) => {
      const dir = (n.direktorat || "").toString().trim() || "Tanpa Direktorat";
      if (!order.has(dir)) order.set(dir, idx);
    });
    return order;
  })();

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
        setIsInherited({ kompetensi: false, diklat: false, dampak: false });
        setInheritedFromMonth(null);
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
      
      // Normalize color untuk data yang di-fetch - HANYA ubah putih/abu-abu menjadi hitam
      const normalizeColor = (html: string): string => {
        if (!html) return html;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Helper untuk cek apakah warna adalah putih/abu-abu
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

        // Set default hitam HANYA untuk elemen yang tidak punya color atau putih/abu-abu
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const styleColor = htmlEl.style.color || '';
          const styleAttr = htmlEl.getAttribute('style') || '';
          
          // Cek apakah ada color di style attribute
          const colorMatch = styleAttr.match(/color:\s*([^;]+)/i);
          const explicitColor = colorMatch ? colorMatch[1].trim() : '';
          
          // Hanya ubah jika: tidak ada color sama sekali ATAU warna adalah putih/abu-abu
          const shouldSetBlack = !styleColor && !explicitColor || 
                                 isWhiteOrGrayColor(styleColor) || 
                                 isWhiteOrGrayColor(explicitColor);
          
          if (shouldSetBlack) {
            const currentStyle = htmlEl.getAttribute('style') || '';
            if (!currentStyle.includes('color:')) {
              htmlEl.setAttribute('style', (currentStyle ? currentStyle + ' ' : '') + 'color: #000000;');
            } else {
              // Replace hanya jika warna adalah putih/abu-abu
              htmlEl.setAttribute('style', currentStyle.replace(/color:\s*[^;]+/gi, 'color: #000000'));
            }
            htmlEl.style.color = '#000000';
          }
          // Jika ada warna valid (bukan putih/abu-abu), JANGAN ubah - biarkan seperti itu
        });
        
        return tempDiv.innerHTML;
      };

      // Set data - jika inherited, set ID ke null agar saat save membuat record baru
      // Pastikan semua data di-set, termasuk yang inherited
      setKompetensiId(kompetensiInherited ? null : (k?.id ?? null));
      setKompetensiIsi(normalizeColor(k?.isi ?? ""));
      setDiklatId(diklatInherited ? null : (d?.id ?? null));
      setDiklatIsi(normalizeColor(d?.isi ?? ""));
      setDampakId(dampakInherited ? null : (p?.id ?? null));
      setDampakIsi(normalizeColor(p?.isi ?? ""));
      
      // Reset mode edit saat data berubah
      setIsEditing({
        kompetensi: false,
        diklat: false,
        dampak: false,
      });
    } catch (e) {
      console.error("Failed to fetch spmt-kompetensi", e);
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

      // Trim isi
      const trimmedIsi = isi.trim();

      if (!trimmedIsi) {
        setSavingJenis(null);
        return;
      }
      
      // Normalize color HANYA untuk elemen yang tidak punya color atau putih/abu-abu
      // JANGAN ubah warna yang sudah dipilih user
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = trimmedIsi;
      
      // Helper untuk cek apakah warna adalah putih/abu-abu
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
      
      // Set default hitam HANYA untuk elemen yang tidak punya color atau putih/abu-abu
      const allElements = tempDiv.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const styleColor = htmlEl.style.color || '';
        const styleAttr = htmlEl.getAttribute('style') || '';
        
        // Cek apakah ada color di style attribute
        const colorMatch = styleAttr.match(/color:\s*([^;]+)/i);
        const explicitColor = colorMatch ? colorMatch[1].trim() : '';
        
        // Hanya ubah jika: tidak ada color sama sekali ATAU warna adalah putih/abu-abu
        const shouldSetBlack = (!styleColor && !explicitColor) || 
                               isWhiteOrGrayColor(styleColor) || 
                               isWhiteOrGrayColor(explicitColor);
        
        if (shouldSetBlack) {
          const currentStyle = htmlEl.getAttribute('style') || '';
          if (!currentStyle.includes('color:')) {
            htmlEl.setAttribute('style', (currentStyle ? currentStyle + ' ' : '') + 'color: #000000;');
          } else {
            // Replace hanya jika warna adalah putih/abu-abu
            htmlEl.setAttribute('style', currentStyle.replace(/color:\s*[^;]+/gi, 'color: #000000'));
          }
          htmlEl.style.color = '#000000';
        }
        // Jika ada warna valid (bukan putih/abu-abu), JANGAN ubah - biarkan seperti itu
      });
      
      // Jika root element tidak punya children dan tidak punya color, wrap dengan div yang punya color
      if (tempDiv.children.length === 0 && !tempDiv.style.color) {
        const textContent = tempDiv.textContent || '';
        if (textContent.trim()) {
          tempDiv.innerHTML = `<div style="color: #000000;">${trimmedIsi}</div>`;
        }
      }
      
      // Ambil HTML yang sudah di-normalize
      isi = tempDiv.innerHTML;

      setSavingJenis(jenis);

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

      let resp: Response;

      if (id && !isInheritedData) {
        // Update data yang sudah ada (bukan inherited)
        resp = await fetch(`/api/admin/spmt-kompetensi/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jenis, isi }),
        });
      } else {
        // Create baru (baik untuk data baru maupun data inherited yang diedit)
        // Juga untuk konsolidasi tahun (monthVal = null)
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

      // Nonaktifkan mode edit setelah fetch data selesai
      await fetchKompetensiData();
      setTimeout(() => {
        setIsEditing((prev) => ({
          ...prev,
          [jenis.toLowerCase()]: false,
        }));
      }, 100);
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
      } else {
        // Fallback aman jika response tidak ok
        const allOption: Daerah = {
          id: 0,
          nama: "Konsolidasi SPMT (Semua Branch)",
          kode: "StandAlone",
        };
        setDaerahList([allOption]);
        setSelectedDaerah("0");
      }
    } catch (error) {
      console.error("Error fetching daerah list:", error);
      // Fallback aman jika gagal fetch
      const allOption: Daerah = {
        id: 0,
        nama: "Konsolidasi SPMT (Semua Branch)",
        kode: "StandAlone",
      };
      setDaerahList([allOption]);
      setSelectedDaerah("0");
    }
  };

  const fetchAvailablePeriods = async () => {
    try {
      const response = await fetch("/api/admin/available-months");
      if (!response.ok) {
        throw new Error(`Failed to load periods: ${response.status}`);
      }
      const data = await response.json();

      if (data.periods && data.periods.length > 0) {
        setAvailablePeriods(data.periods);
        setSelectedPeriod(data.periods[0].value);
      } else {
        // Tidak ada periode tersedia -> hentikan loading dan tampilkan state kosong
        setAvailablePeriods([]);
        setSelectedPeriod("");
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
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
      // Gagal memuat periode -> hentikan loading dan tampilkan state kosong
      setAvailablePeriods([]);
      setSelectedPeriod("");
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
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Validasi dulu agar tidak mengaktifkan loading tanpa kebutuhan
      if (!selectedPeriod || !selectedDaerah) return;

      setLoading(true);

      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? null : monthPart;
      const year = yearPart;

      const params = new URLSearchParams();
      if (month) params.append("month", month);
      params.append("year", year);

      // Hanya kirim daerah_id jika bukan StandAlone
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
      
      // Cek apakah response OK sebelum parse JSON
      let tableData;
      if (!tableResponse.ok) {
        const errorText = await tableResponse.text().catch(() => 'Unknown error');
        console.error('Table API Error:', {
          status: tableResponse.status,
          statusText: tableResponse.statusText,
          error: errorText
        });
        tableData = { success: false, error: `HTTP ${tableResponse.status}: ${tableResponse.statusText}` };
      } else {
        tableData = await tableResponse.json();
      }

      const chartResponse = await fetch(
        `/api/admin/dashboard-stats?${params.toString()}`
      );
      
      // Cek apakah response OK sebelum parse JSON
      let chartData;
      if (!chartResponse.ok) {
        const errorText = await chartResponse.text().catch(() => 'Unknown error');
        console.error('Chart API Error:', {
          status: chartResponse.status,
          statusText: chartResponse.statusText,
          error: errorText
        });
        chartData = { success: false, error: `HTTP ${chartResponse.status}: ${chartResponse.statusText}` };
      } else {
        chartData = await chartResponse.json();
      }

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
      
      let bopoResult = { success: false, data: [] };
      if (bopoResponse.ok) {
        bopoResult = await bopoResponse.json();
      }

      if (tableData.success && chartData.success) {
        // Set BOPO data if available
        let bopoData = null;
        if (
          bopoResult.success &&
          bopoResult.data &&
          bopoResult.data.length > 0
        ) {
          bopoData = bopoResult.data[0];
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
        
        // Tampilkan error message ke user
        if (!tableData.success) {
          alert(`Error fetching table data: ${tableData.error || 'Unknown error'}`);
        }
        if (!chartData.success) {
          alert(`Error fetching chart data: ${chartData.error || 'Unknown error'}`);
        }
        
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

    // const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    // const bulanName = bulanNames[bulanInt - 1];

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const confirmDeleteData = async () => {
    if (!deleteBulan || !deleteTahun) {
      return;
    }

    const bulanInt = parseInt(deleteBulan);
    const tahunInt = parseInt(deleteTahun);
    const bulanName = getBulanName();
    const tahunValue = deleteTahun;

    setShowConfirmModal(false);
    setDeleting(true);

    try {
      const response = await fetch(`/api/admin/spmt-data?bulan=${bulanInt}&tahun=${tahunInt}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Reset form first
        setDeleteBulan('');
        setDeleteTahun('');
        
        // Show success alert
        alert(`Berhasil menghapus ${data.deletedCount || 0} data SPMT untuk bulan ${bulanName} ${tahunValue}`, 'success');
        
        // Refresh data after deletion - fetch available periods first, then dashboard data
        await fetchAvailablePeriods();
        // Small delay to ensure periods are updated
        setTimeout(() => {
          fetchDashboardData();
        }, 300);
      } else {
        alert(data.error || 'Gagal menghapus data SPMT', 'error');
      }
    } catch (error) {
      console.error('Error deleting SPMT data:', error);
      alert('Terjadi kesalahan saat menghapus data SPMT', 'error');
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportStrukturPDF = async () => {
    if (!strukturOrgRef.current) {
      alert("Tidak ada struktur organisasi untuk diekspor");
      return;
    }

    try {
      setExportingStrukturPDF(true);

      const daerahName = selectedDaerahInfo?.nama || "SPMT";
      const fileName = `${daerahName}_Struktur_Organisasi.pdf`;

      // Wait a bit for ReactFlow to render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Capture the struktur organisasi section
      const canvas = await html2canvas(strukturOrgRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        onclone: (clonedDoc) => {
          try {
            // Convert computed colors to inline styles to avoid oklch parsing
            const allElements = clonedDoc.querySelectorAll("*");
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              try {
                const computedStyle = window.getComputedStyle(htmlEl);
                const bgColor = computedStyle.backgroundColor;
                if (
                  bgColor &&
                  bgColor !== "rgba(0, 0, 0, 0)" &&
                  bgColor !== "transparent" &&
                  !bgColor.includes("oklch") &&
                  !bgColor.includes("color-mix")
                ) {
                  htmlEl.style.backgroundColor = bgColor;
                }
                const textColor = computedStyle.color;
                if (
                  textColor &&
                  !textColor.includes("oklch") &&
                  !textColor.includes("color-mix")
                ) {
                  htmlEl.style.color = textColor;
                }
                const borderColor = computedStyle.borderColor;
                if (
                  borderColor &&
                  borderColor !== "rgba(0, 0, 0, 0)" &&
                  !borderColor.includes("oklch") &&
                  !borderColor.includes("color-mix")
                ) {
                  htmlEl.style.borderColor = borderColor;
                }
              } catch {
                // Ignore
              }
            });
          } catch {
            // Ignore error in onclone
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Add image to PDF
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

      // If content is taller than one page, add additional pages
      let heightLeft = imgHeight;
      let position = 0;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Save the PDF
      pdf.save(fileName);
    } catch (error) {
      console.error("Error exporting struktur to PDF:", error);
      alert("Gagal mengekspor struktur organisasi ke PDF. Silakan coba lagi.");
    } finally {
      setExportingStrukturPDF(false);
    }
  };

  const selectedDaerahInfo = daerahList.find(
    (d) => d.id.toString() === selectedDaerah
  );

  // Format judul untuk export PDF
  const getExportTitle = () => {
    if (!selectedDaerahInfo) {
      return "Konsolidasi SPMT (Semua Branch)";
    }
    // Jika sudah berformat "Konsolidasi SPMT (Semua Branch)", gunakan langsung
    if (
      selectedDaerahInfo.nama &&
      selectedDaerahInfo.nama.includes("Konsolidasi SPMT")
    ) {
      return selectedDaerahInfo.nama;
    }
    // Jika hanya nama daerah, format menjadi "Konsolidasi SPMT (Nama Daerah)"
    if (selectedDaerahInfo.nama) {
      const formatted = `Konsolidasi SPMT (${selectedDaerahInfo.nama})`;
      return formatted;
    }
    return "Konsolidasi SPMT (Semua Branch)";
  };

  // Debug: log untuk memastikan fungsi bekerja
  const exportTitle = getExportTitle();

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

  // Jika tidak loading namun tidak ada periode -> tampilkan empty state ramah
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
            Silakan unggah data SPMT terlebih dahulu atau pilih periode lain.
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
        a[href*="regional"] {
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
          DAERAH : {selectedDaerahInfo?.kode || "StandAlone"} -{" "}
          {selectedDaerahInfo?.nama || "Konsolidasi SPMT (Semua Branch)"}
        </div>

        <div className="bg-gradient-to-r text-black">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">
                DEMOGRAFI SDM - {exportTitle}
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
                  JUMLAH - {selectedDaerahInfo?.kode}
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Pekerja */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {formatNumber(stats?.chartData.total ?? null)}
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
                          stats?.bopoData?.produktivitas_efisiensi ?? null
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
                          {formatNumber(stats?.bopoData?.bopo_ratio ?? null)}%
                        </div>
                        <div className="text-xs">BOPO</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl">
                      <div className="text-center">
                        <div className="text-xl font-bold">
                          {formatNumber(
                            stats?.bopoData?.rasio_beban_penghasilan_usaha ??
                              null
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
                    {selectedDaerah === "0" ? (
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
                    {selectedDaerah === "0" ? (
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
                              style={{ color: '#000000' }}
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

                {/* Dampak */}
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
                    {selectedDaerah === "0" ? (
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

          {/* Hapus Data SPMT Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Hapus Data SPMT per Bulan
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Pilih bulan dan tahun untuk menghapus data SPMT dari sistem. Tindakan ini tidak dapat dibatalkan.
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
                  {deleting ? 'Menghapus...' : 'Hapus Data SPMT'}
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
                    Hapus Data SPMT
                  </h3>

                  {/* Message */}
                  <div className="mt-3 px-4">
                    <p className="text-sm text-gray-600">
                      Apakah Anda yakin ingin <span className="font-medium text-red-600">menghapus</span> semua data SPMT untuk bulan <span className="font-medium">{getBulanName()}</span> <span className="font-medium">{deleteTahun}</span>?<br />Tindakan ini tidak dapat dibatalkan.
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
