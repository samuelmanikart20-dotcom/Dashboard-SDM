"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import OrgChart, { OrgItem, OrgChartRef } from "./OrgChart";
import { useToast } from "@/components/Toast";
import { FaUpload } from "react-icons/fa";

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
  no_hp: string | null;
  tmt_jabatan: string | null;
  periode_jabatan: string | null;
  kj_individu: string | null;
  kj_posisi: string | null;
  bulan: number | null;
  tahun: number | null;
}

interface DashboardOrgChartProps {
  daerahId: string;
  selectedPeriod: string;
  divisi?: "SPMT" | "PTP" | "IKT" | "TCU";
  daerahKode?: string;
  direktoratName?: string;
  onTitleUpdate?: (title: string) => void;
  readOnly?: boolean;
}

export default function DashboardOrgChart({
  daerahId,
  selectedPeriod,
  divisi = "SPMT",
  daerahKode,
  direktoratName,
  onTitleUpdate,
  readOnly = false,
}: DashboardOrgChartProps) {
  const toast = useToast();
  const [items, setItems] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgPositionNode | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<OrgPositionNode>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const orgChartRef = useRef<OrgChartRef>(null);

  const fetchOrgData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Parse periode - format: "bulan-tahun" (contoh: "8-2024")
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? "all" : monthPart;
      const year = yearPart || "all";
      const useDirektoratFilter =
        !!direktoratName && direktoratName.trim() !== "" && direktoratName !== "all";

      // Validasi format periode
      if (!selectedPeriod || selectedPeriod === "" || (!monthPart || !yearPart)) {
        throw new Error(`Format periode tidak valid: "${selectedPeriod}". Format yang benar: "bulan-tahun" (contoh: "8-2024")`);
      }

      // Tentukan endpoint berdasarkan divisi
      let baseUrl = "/api/admin/org-positions";
      if (divisi === "PTP") {
        baseUrl = "/api/admin/ptp-struktur-organisasi/positions";
      } else if (divisi === "IKT") {
        baseUrl = "/api/admin/ikt-struktur-organisasi/positions";
      } else if (divisi === "TCU") {
        baseUrl = "/api/admin/tcu-struktur-organisasi/positions";
      }

      // Handle "Semua Daerah" - tidak kirim daerah_id jika "all"
      const queryParams = new URLSearchParams();
      if (daerahId && daerahId !== "all") {
        queryParams.set("daerah_id", daerahId);
      } else {
        queryParams.set("daerah_id", "all");
      }
      queryParams.set("month", month);
      queryParams.set("year", year);
      if (useDirektoratFilter) {
        queryParams.set("direktorat", direktoratName!.trim());
      }

      const url = `${baseUrl}?${queryParams.toString()}`;
      console.log(`[DashboardOrgChart] Fetching from: ${url}`);
      console.log(`[DashboardOrgChart] Requested period: ${month}/${year} (from selectedPeriod: "${selectedPeriod}")`);
      console.log(`[DashboardOrgChart] Daerah: ${daerahId === "all" ? "Semua Daerah" : daerahId}`);
      console.log(`[DashboardOrgChart] Direktorat filter: ${useDirektoratFilter ? direktoratName : "none"}`);
      
      // PERBAIKAN: Tambahkan cache-busting untuk memastikan selalu mengambil data terbaru
      // Ini memastikan ketika data di-edit di "Upload Struktur Organisasi", perubahan langsung muncul di "Lihat Struktur Organisasi"
      const urlWithCacheBust = `${url}&_t=${Date.now()}`;
      const res = await fetch(urlWithCacheBust, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal memuat data struktur organisasi");
      }

      const data = (json.data || []) as OrgPositionNode[];
      console.log(`[DashboardOrgChart] Received ${data.length} nodes from API`);
      
      // Log periode dari data yang diterima untuk debugging
      if (data.length > 0) {
        const periodsInData = new Set(data.map(n => `${n.bulan}-${n.tahun}`));
        console.log(`[DashboardOrgChart] Periods in received data: ${Array.from(periodsInData).join(', ')}`);
        console.log(`[DashboardOrgChart] Requested period: ${month}/${year}`);
        
        // Cek apakah ada data dengan periode yang tidak sesuai
        const mismatchedPeriods = data.filter(n => {
          if (month !== 'all' && year !== 'all') {
            return n.bulan !== parseInt(month) || n.tahun !== parseInt(year);
          }
          return false;
        });
        if (mismatchedPeriods.length > 0) {
          console.warn(`[DashboardOrgChart] WARNING: Found ${mismatchedPeriods.length} nodes with mismatched period!`);
          console.warn(`[DashboardOrgChart] Mismatched nodes:`, mismatchedPeriods.map(n => ({
            id_posisi_sap: n.id_posisi_sap,
            nama: n.nama,
            bulan: n.bulan,
            tahun: n.tahun
          })));
        }
      }

      // PERBAIKAN: Untuk PTP, jika backend mengirim ID unik (format: sapId_daerahId),
      // kita perlu menggunakan ID tersebut untuk node, tapi parentId tetap menggunakan ID POSISI SAP
      // yang kemudian di-mapping ke ID unik
      
      // Build mapping: ID POSISI SAP -> ID unik (untuk parent-child relationship)
      const sapIdToUniqueId = new Map<string, string>();
      const uniqueIdToSapId = new Map<string, string>();
      for (const node of data) {
        const nodeId = String(node.id || node.id_posisi_sap || '').trim();
        const sapId = String(node.id_posisi_sap || '').trim();
        
        // Jika ID node mengandung underscore (format: sapId_daerahId), berarti backend menggunakan ID unik
        if (nodeId.includes('_') && nodeId !== sapId) {
          uniqueIdToSapId.set(nodeId, sapId);
          // Untuk setiap ID POSISI SAP, simpan ID unik pertama yang ditemukan (prioritaskan dari daerah target jika ada)
          if (!sapIdToUniqueId.has(sapId)) {
            sapIdToUniqueId.set(sapId, nodeId);
          }
        } else {
          // Jika tidak ada ID unik, gunakan ID POSISI SAP langsung
          sapIdToUniqueId.set(sapId, nodeId);
          uniqueIdToSapId.set(nodeId, sapId);
        }
      }
      
      // Build set of valid SAP IDs untuk validasi parent
      const validSapIds = new Set<string>();
      for (const node of data) {
        if (node.id_posisi_sap) {
          validSapIds.add(String(node.id_posisi_sap).trim());
        }
      }

      // Convert ke OrgItem format
      const orgItems: OrgItem[] = data.map((node) => {
        const isVacant = !node.nama || node.nama.trim() === "";
        
        // Pastikan photoUrl diambil dengan benar
        const photoUrl = node.photo_url && node.photo_url.trim() !== '' ? node.photo_url.trim() : undefined;
        
        // Log untuk debugging jika ada photoUrl
        if (photoUrl) {
          console.log(`[DashboardOrgChart] Node ${node.id_posisi_sap} (${node.nama || 'N/A'}) has photoUrl: ${photoUrl}`);
        }
        
        // Pastikan no_hp diambil dengan benar, termasuk trim dan validasi
        const noHp = node.no_hp && String(node.no_hp).trim() !== '' && String(node.no_hp).trim() !== '-' 
          ? String(node.no_hp).trim() 
          : undefined;
        
        // Gunakan ID unik jika ada, jika tidak gunakan ID POSISI SAP
        const nodeId = String(node.id || node.id_posisi_sap || '').trim();
        
        // PERBAIKAN: Untuk parentId, cari ID unik dari parent berdasarkan ID POSISI ATASAN
        let parentId: string | null = null;
        if (node.id_posisi_atasan) {
          const atasanSap = String(node.id_posisi_atasan).trim();
          // Cari ID unik dari parent berdasarkan ID POSISI SAP
          // Untuk TCU: Prioritaskan parent dari daerah yang sama dengan child node
          if (validSapIds.has(atasanSap)) {
            // Untuk TCU, cari parent dari sistem (unit_kerja) yang sama dengan child node
            if (divisi === "TCU" && node.daerah_id) {
              const nodeUnitKerja = node.unit_kerja ? String(node.unit_kerja).trim() : null;
              
              // Prioritas 1: Cari parent dengan ID POSISI SAP yang sama, daerah_id yang sama, DAN unit_kerja yang sama (sistem yang sama)
              let parentNode = null;
              if (nodeUnitKerja) {
                parentNode = data.find(
                  (n) =>
                    String(n.id_posisi_sap || "").trim() === atasanSap &&
                    n.daerah_id === node.daerah_id &&
                    n.unit_kerja &&
                    String(n.unit_kerja).trim() === nodeUnitKerja
                );
              }
              
              // Prioritas 2: Jika tidak ada di sistem yang sama, cari dari daerah yang sama (tanpa filter unit_kerja)
              if (!parentNode) {
                parentNode = data.find(
                  (n) =>
                    String(n.id_posisi_sap || "").trim() === atasanSap &&
                    n.daerah_id === node.daerah_id
                );
              }
              
              // Prioritas 3: Jika tidak ada di daerah yang sama, cari dari sistem yang sama (tanpa filter daerah_id)
              if (!parentNode && nodeUnitKerja) {
                parentNode = data.find(
                  (n) =>
                    String(n.id_posisi_sap || "").trim() === atasanSap &&
                    n.unit_kerja &&
                    String(n.unit_kerja).trim() === nodeUnitKerja
                );
              }
              
              // Prioritas 4: Fallback - cari dari manapun (tanpa filter)
              if (!parentNode) {
                parentNode = data.find(
                  (n) => String(n.id_posisi_sap || "").trim() === atasanSap
                );
              }
              
              if (parentNode) {
                const parentNodeId = String(parentNode.id || parentNode.id_posisi_sap || "").trim();
                parentId = parentNodeId;
              }
            } else {
              // Untuk non-TCU: Cari parent dengan ID POSISI SAP yang sama, prioritaskan dari daerah yang sama
              const parentNode = data.find(n => 
                String(n.id_posisi_sap || '').trim() === atasanSap &&
                String(n.daerah_id || '') === String(node.daerah_id || '')
              ) || data.find(n => String(n.id_posisi_sap || '').trim() === atasanSap);
              
              if (parentNode) {
                parentId = String(parentNode.id || parentNode.id_posisi_sap || '').trim();
              } else {
                // Fallback: gunakan mapping
                parentId = sapIdToUniqueId.get(atasanSap) || atasanSap;
              }
            }
          } else {
            // Log warning jika parent tidak ditemukan
            console.warn(`[DashboardOrgChart] Parent ID ${atasanSap} untuk node ${node.id_posisi_sap} (${node.nama || 'N/A'}, daerah: ${node.daerah_id || 'N/A'}) tidak ditemukan di dataset. Node akan ditampilkan sebagai root.`);
          }
        }
        
        return {
          id: nodeId, // Gunakan ID unik jika ada
          parentId: parentId,
          // Untuk vacant, label kosong agar OrgChart bisa detect sebagai vacant
          // OrgChart akan menampilkan "VACANT" otomatis
          label: isVacant ? "" : (node.nama || ""),
          subtitle: node.nama_posisi || node.nama_jabatan_sap || "-",
          positionTitle: node.nama_posisi || node.nama_jabatan_sap || undefined,
          unit: node.unit_kerja ?? undefined,
          nipp: node.nipp ?? undefined,
          photoUrl: photoUrl, // Pastikan photoUrl di-set dengan benar
          no_hp: noHp, // Pastikan no_hp di-set dengan benar
          tmt_jabatan: node.tmt_jabatan || undefined,
          periode_jabatan: node.periode_jabatan || undefined,
          kj_individu: node.kj_individu || undefined,
          kj_posisi: node.kj_posisi || undefined,
          badgeColor: isVacant ? "#ef4444" : "#1E40AF",
        };
      });

      // Log foto yang ditemukan
      const itemsWithPhoto = orgItems.filter(item => item.photoUrl);
      const itemsWithoutPhoto = orgItems.filter(item => !item.photoUrl);
      console.log(`[DashboardOrgChart] Converted to ${orgItems.length} OrgItems`);
      console.log(`[DashboardOrgChart] Items with photo: ${itemsWithPhoto.length}/${orgItems.length}`);
      console.log(`[DashboardOrgChart] Items without photo: ${itemsWithoutPhoto.length}/${orgItems.length}`);
      
      // Log no_hp yang ditemukan
      const itemsWithPhone = orgItems.filter(item => item.no_hp && item.no_hp.trim() !== '');
      const itemsWithoutPhone = orgItems.filter(item => !item.no_hp || item.no_hp.trim() === '');
      console.log(`[DashboardOrgChart] Items with phone: ${itemsWithPhone.length}/${orgItems.length}`);
      console.log(`[DashboardOrgChart] Items without phone: ${itemsWithoutPhone.length}/${orgItems.length}`);
      if (itemsWithPhone.length > 0) {
        console.log(`[DashboardOrgChart] Sample items with phone:`, itemsWithPhone.slice(0, 3).map(item => ({
          id: item.id,
          label: item.label,
          no_hp: item.no_hp
        })));
      }
      if (itemsWithPhoto.length > 0) {
        console.log(`[DashboardOrgChart] Sample items with photo:`, itemsWithPhoto.slice(0, 3).map(item => ({
          id: item.id,
          label: item.label,
          photoUrl: item.photoUrl
        })));
      }
      if (itemsWithoutPhoto.length > 0 && itemsWithoutPhoto.length <= 10) {
        console.log(`[DashboardOrgChart] Items without photo:`, itemsWithoutPhoto.map(item => ({
          id: item.id,
          label: item.label
        })));
      }
      
      // Log raw data dari API untuk debugging
      const nodesWithPhotoFromAPI = data.filter((node: OrgPositionNode) => node.photo_url && node.photo_url.trim() !== '');
      console.log(`[DashboardOrgChart] Raw API data - nodes with photo_url: ${nodesWithPhotoFromAPI.length}/${data.length}`);
      
      // Log sample node untuk melihat semua field yang ada
      if (data.length > 0) {
        const sampleNode = data[0] as OrgPositionNode;
        console.log(`[DashboardOrgChart] Sample node from API (all fields):`, {
          id_posisi_sap: sampleNode.id_posisi_sap,
          nama: sampleNode.nama,
          nipp: sampleNode.nipp,
          unit_kerja: sampleNode.unit_kerja,
          direktorat: sampleNode.direktorat,
          tingkatan: sampleNode.tingkatan,
          no_hp: sampleNode.no_hp,
          tmt_jabatan: sampleNode.tmt_jabatan,
          periode_jabatan: sampleNode.periode_jabatan,
          kj_individu: sampleNode.kj_individu,
          kj_posisi: sampleNode.kj_posisi,
          nama_posisi: sampleNode.nama_posisi,
          nama_jabatan_sap: sampleNode.nama_jabatan_sap,
          photo_url: sampleNode.photo_url,
          bulan: sampleNode.bulan,
          tahun: sampleNode.tahun,
        });
      }
      
      if (nodesWithPhotoFromAPI.length > 0) {
        console.log(`[DashboardOrgChart] Sample raw photo_url from API:`, nodesWithPhotoFromAPI.slice(0, 3).map((node: OrgPositionNode) => ({
          id_posisi_sap: node.id_posisi_sap,
          nama: node.nama,
          photo_url: node.photo_url,
          bulan: node.bulan,
          tahun: node.tahun
        })));
      }
      
      setItems(orgItems);
      
      // PERBAIKAN: Panggil callback untuk update title setelah items di-set
      // Pindahkan logika update title ke sini agar dipanggil setelah data benar-benar dimuat
      if ((divisi === "PTP" || divisi === "TCU") && onTitleUpdate && data.length > 0) {
        console.log(`[DashboardOrgChart] PTP - Updating title from data. Total nodes: ${data.length}`);
        
        // PERBAIKAN: Untuk PTP, ambil semua data untuk periode yang sama (tanpa filter daerah)
        // untuk menentukan title yang benar (bukan hanya dari satu daerah)
        // Fetch semua data untuk periode yang sama untuk mendapatkan semua direktorat
        const fetchAllDataForTitle = async () => {
          try {
            const [monthPart, yearPart] = selectedPeriod.split("-");
            const month = monthPart === "all" ? "all" : monthPart;
            const year = yearPart || "all";
            
            const queryParams = new URLSearchParams();
            queryParams.set("daerah_id", "all"); // Ambil semua daerah untuk menentukan title
            queryParams.set("month", month);
            queryParams.set("year", year);
            
            const url = `/api/admin/ptp-struktur-organisasi/positions?${queryParams.toString()}`;
            console.log(`[DashboardOrgChart] Fetching all data for title from: ${url}`);
            const res = await fetch(url);
            const json = await res.json();
            
            if (res.ok && json?.success) {
              const allData = (json.data || []) as OrgPositionNode[];
              console.log(`[DashboardOrgChart] Fetched ${allData.length} total nodes for title determination`);
              
              // Ambil unit_kerja atau direktorat yang paling banyak muncul di semua data
              // Prioritas: unit_kerja > direktorat
              const titleCount = new Map<string, number>();
              for (const node of allData) {
                // Prioritas: unit_kerja dulu, baru direktorat
                const titleValue = (node.unit_kerja && node.unit_kerja.trim() !== '') 
                  ? node.unit_kerja.trim() 
                  : (node.direktorat && node.direktorat.trim() !== '') 
                    ? node.direktorat.trim() 
                    : '';
                
                if (titleValue) {
                  const currentCount = titleCount.get(titleValue) || 0;
                  titleCount.set(titleValue, currentCount + 1);
                }
              }
              
              console.log(`[DashboardOrgChart] Title count (unit_kerja/direktorat) from all data:`, Array.from(titleCount.entries()));
              
              // Cari yang paling banyak muncul
              let mostCommonTitle = '';
              let maxCount = 0;
              for (const [title, count] of titleCount.entries()) {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommonTitle = title;
                }
              }
              
              // Jika tidak ada yang dominan, ambil yang pertama (prioritaskan unit_kerja)
              if (!mostCommonTitle && allData.length > 0) {
                mostCommonTitle = (allData[0].unit_kerja && allData[0].unit_kerja.trim() !== '') 
                  ? allData[0].unit_kerja.trim() 
                  : (allData[0].direktorat && allData[0].direktorat.trim() !== '') 
                    ? allData[0].direktorat.trim() 
                    : '';
                console.log(`[DashboardOrgChart] No dominant title, using first: ${mostCommonTitle}`);
              }
              
              // Update title dengan unit_kerja/direktorat dari semua data
              if (mostCommonTitle && mostCommonTitle.trim() !== '') {
                console.log(`[DashboardOrgChart] Calling onTitleUpdate with: ${mostCommonTitle}`);
                onTitleUpdate(mostCommonTitle);
              } else {
                console.warn(`[DashboardOrgChart] No unit_kerja/direktorat found in all data to update title`);
              }
            }
          } catch (error) {
            console.error(`[DashboardOrgChart] Error fetching all data for title:`, error);
            // Fallback: gunakan data yang sudah ada
            const titleCount = new Map<string, number>();
            for (const node of data) {
              const titleValue = (node.unit_kerja && node.unit_kerja.trim() !== '') 
                ? node.unit_kerja.trim() 
                : (node.direktorat && node.direktorat.trim() !== '') 
                  ? node.direktorat.trim() 
                  : '';
              
              if (titleValue) {
                const currentCount = titleCount.get(titleValue) || 0;
                titleCount.set(titleValue, currentCount + 1);
              }
            }
            
            let mostCommonTitle = '';
            let maxCount = 0;
            for (const [title, count] of titleCount.entries()) {
              if (count > maxCount) {
                maxCount = count;
                mostCommonTitle = title;
              }
            }
            
            if (mostCommonTitle && mostCommonTitle.trim() !== '') {
              onTitleUpdate(mostCommonTitle);
            }
          }
        };
        
        // Panggil async function untuk fetch semua data
        fetchAllDataForTitle();
      }
    } catch (err: any) {
      console.error("[DashboardOrgChart] Error fetching org data:", err);
      setError(err.message || "Gagal memuat data struktur organisasi");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [daerahId, selectedPeriod, divisi, direktoratName, onTitleUpdate]);

  useEffect(() => {
    console.log(`[DashboardOrgChart] useEffect triggered - daerahId: ${daerahId}, selectedPeriod: ${selectedPeriod}, divisi: ${divisi}, direktorat: ${direktoratName || 'none'}`);
    console.log(`[DashboardOrgChart] Current items.length: ${items.length}`);
    
    if (!daerahId || daerahId === "0" || daerahId === "" || !selectedPeriod || selectedPeriod === "") {
      console.log(`[DashboardOrgChart] Skipping fetch - invalid params`);
      // Jangan clear items jika sudah ada data, biarkan tetap tampil
      // setItems([]);
      return;
    }

    console.log(`[DashboardOrgChart] Fetching org data...`);
    fetchOrgData();
  }, [daerahId, selectedPeriod, divisi, direktoratName, fetchOrgData]);

  const handleNodeClick = async (nodeId: string) => {
    try {
      // PERBAIKAN: Untuk PTP dan IKT, nodeId mungkin menggunakan format sapId_daerahId
      // Kita perlu extract id_posisi_sap dari nodeId jika mengandung underscore
      let sapId = nodeId;
      if ((divisi === "PTP" || divisi === "IKT" || divisi === "TCU") && nodeId.includes('_')) {
        // Format: sapId_daerahId, ambil bagian sebelum underscore
        sapId = nodeId.split('_')[0];
        console.log(`[DashboardOrgChart] ${divisi} node clicked - extracted SAP ID: ${sapId} from nodeId: ${nodeId}`);
      }

      // Fetch detail node dari API
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? "all" : monthPart;
      const year = yearPart || "all";
      const useDirektoratFilter =
        !!direktoratName && direktoratName.trim() !== "" && direktoratName !== "all";

      let baseUrl = "/api/admin/org-positions";
      if (divisi === "PTP") {
        baseUrl = "/api/admin/ptp-struktur-organisasi/positions";
      } else if (divisi === "IKT") {
        baseUrl = "/api/admin/ikt-struktur-organisasi/positions";
      } else if (divisi === "TCU") {
        baseUrl = "/api/admin/tcu-struktur-organisasi/positions";
      }

      const queryParams = new URLSearchParams();
      queryParams.set("daerah_id", daerahId || "all");
      queryParams.set("month", month);
      queryParams.set("year", year);
      if (useDirektoratFilter) {
        queryParams.set("direktorat", direktoratName!.trim());
      }

      const url = `${baseUrl}?${queryParams.toString()}`;
      console.log(`[DashboardOrgChart] Fetching node detail from: ${url}`);
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json?.success) {
        const data = (json.data || []) as OrgPositionNode[];
        console.log(`[DashboardOrgChart] handleNodeClick - Received ${data.length} nodes from API`);
        console.log(`[DashboardOrgChart] handleNodeClick - Looking for nodeId: ${nodeId}, sapId: ${sapId}, divisi: ${divisi}`);
        
        // PERBAIKAN: Untuk PTP dan IKT, cari berdasarkan id_posisi_sap (bukan node.id yang mungkin unik)
        // Untuk SPMT, cari berdasarkan id_posisi_sap atau id
        const node = data.find((n) => {
          if (divisi === "PTP" || divisi === "IKT" || divisi === "TCU") {
            // Untuk PTP dan IKT, bandingkan id_posisi_sap dengan sapId yang sudah di-extract
            // Karena PTP dan IKT menggunakan unique ID format sapId_daerahId, kita perlu extract sapId dulu
            return n.id_posisi_sap === sapId;
          } else {
            // Untuk SPMT, bandingkan id_posisi_sap atau id dengan nodeId
            const matchById = n.id && String(n.id) === String(nodeId);
            const matchBySapId = n.id_posisi_sap && String(n.id_posisi_sap) === String(nodeId);
            if (matchById || matchBySapId) {
              console.log(`[DashboardOrgChart] handleNodeClick - Found match:`, {
                id: n.id,
                id_posisi_sap: n.id_posisi_sap,
                nama: n.nama,
                matchById,
                matchBySapId
              });
              return true;
            }
            return false;
          }
        });
        
        if (node) {
          console.log(`[DashboardOrgChart] Node clicked - all fields:`, {
            id: node.id,
            id_posisi_sap: node.id_posisi_sap,
            daerah_id: node.daerah_id,
            nama: node.nama,
            nipp: node.nipp,
            unit_kerja: node.unit_kerja,
            direktorat: node.direktorat,
            tingkatan: node.tingkatan,
            no_hp: node.no_hp,
            tmt_jabatan: node.tmt_jabatan,
            periode_jabatan: node.periode_jabatan,
            kj_individu: node.kj_individu,
            kj_posisi: node.kj_posisi,
            nama_posisi: node.nama_posisi,
            nama_jabatan_sap: node.nama_jabatan_sap,
            photo_url: node.photo_url,
            bulan: node.bulan,
            tahun: node.tahun,
          });
          setSelectedNode(node);
          setEditedData({
            nama: node.nama,
            nipp: node.nipp,
            unit_kerja: node.unit_kerja,
            direktorat: node.direktorat,
            tingkatan: node.tingkatan,
            no_hp: node.no_hp,
            tmt_jabatan: node.tmt_jabatan,
            periode_jabatan: node.periode_jabatan,
            kj_individu: node.kj_individu,
            kj_posisi: node.kj_posisi,
            nama_posisi: node.nama_posisi,
            nama_jabatan_sap: node.nama_jabatan_sap,
          });
          setIsEditing(false);
          setShowModal(true);
        } else {
          console.warn(`[DashboardOrgChart] Node not found - nodeId: ${nodeId}, sapId: ${sapId}, divisi: ${divisi}`);
          console.warn(`[DashboardOrgChart] Available nodes:`, data.map(n => ({ id: n.id, id_posisi_sap: n.id_posisi_sap })));
        }
      } else {
        console.error(`[DashboardOrgChart] Failed to fetch node detail:`, json);
      }
    } catch (err) {
      console.error("Error fetching node detail:", err);
      alert("Gagal memuat detail posisi. Silakan coba lagi.");
    }
  };

  const handleSave = async () => {
    if (!selectedNode) return;

    setSaving(true);
    try {
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? "all" : monthPart;
      const year = yearPart || "all";

      // Validasi periode harus spesifik untuk menyimpan
      if (month === "all" || year === "all") {
        alert("Periode harus spesifik untuk menyimpan data");
        setSaving(false);
        return;
      }

      let baseUrl = "/api/admin/org-positions";
      if (divisi === "PTP") {
        baseUrl = "/api/admin/ptp-struktur-organisasi/positions";
      } else if (divisi === "IKT") {
        baseUrl = "/api/admin/ikt-struktur-organisasi/positions";
      } else if (divisi === "TCU") {
        baseUrl = "/api/admin/tcu-struktur-organisasi/positions";
      }

      // PERBAIKAN: Resolve daerah_id dengan prioritas:
      // 1. Jika daerahId bukan "all", gunakan itu
      // 2. Jika selectedNode punya daerah_id, gunakan itu (paling akurat karena dari database)
      // 3. Jika tidak ada, coba fetch dari database dengan filter direktorat jika ada
      let resolvedDaerahId: string | null = null;
      
      if (daerahId && daerahId !== "all") {
        resolvedDaerahId = daerahId;
      } else if (selectedNode.daerah_id) {
        resolvedDaerahId = String(selectedNode.daerah_id);
      }

      // PERBAIKAN: Ambil data lengkap dari database sebelum save
      // Ini memastikan kita memiliki semua field yang ada di database, bukan hanya yang ada di selectedNode
      // PENTING: Jangan gunakan filter direktorat saat fetch fullNodeData karena node mungkin belum punya direktorat yang match
      // atau direktorat mungkin akan diubah saat save
      let fullNodeData: OrgPositionNode | null = null;
      try {
        // Build query TANPA filter direktorat untuk memastikan kita bisa menemukan node
        const queryParams = new URLSearchParams();
        if (resolvedDaerahId) {
          queryParams.set("daerah_id", resolvedDaerahId);
        } else {
          queryParams.set("daerah_id", "all");
        }
        queryParams.set("month", month);
        queryParams.set("year", year);
        // JANGAN tambahkan filter direktorat di sini karena kita perlu menemukan node terlepas dari direktorat-nya
        
        const url = `${baseUrl}?${queryParams.toString()}`;
        console.log(`[DashboardOrgChart] Fetching full node data from database before save (without direktorat filter): ${url}`);
        const res = await fetch(url);
        const json = await res.json();
        if (res.ok && json?.success) {
          const data = (json.data || []) as OrgPositionNode[];
          fullNodeData = data.find((n) => n.id_posisi_sap === selectedNode.id_posisi_sap) || null;
          
          // Jika belum ada resolvedDaerahId dan fullNodeData ditemukan, gunakan daerah_id dari fullNodeData
          if (!resolvedDaerahId && fullNodeData && fullNodeData.daerah_id) {
            resolvedDaerahId = String(fullNodeData.daerah_id);
            console.log(`[DashboardOrgChart] Resolved daerah_id from fullNodeData: ${resolvedDaerahId}`);
          }
          
          if (fullNodeData) {
            console.log(`[DashboardOrgChart] Found full node data from database:`, {
              id_posisi_sap: fullNodeData.id_posisi_sap,
              daerah_id: fullNodeData.daerah_id,
              nama: fullNodeData.nama,
              tingkatan: fullNodeData.tingkatan,
              direktorat: fullNodeData.direktorat,
              no_hp: fullNodeData.no_hp,
              kj_individu: fullNodeData.kj_individu,
              kj_posisi: fullNodeData.kj_posisi,
              photo_url: fullNodeData.photo_url,
            });
          } else {
            console.warn(`[DashboardOrgChart] Node not found in database, using selectedNode data`);
          }
        }
      } catch (err) {
        console.error("[DashboardOrgChart] Error fetching full node data:", err);
        // Continue dengan selectedNode jika gagal fetch
      }

      // Final check: jika masih belum ada resolvedDaerahId, gunakan dari selectedNode
      if (!resolvedDaerahId && selectedNode.daerah_id) {
        resolvedDaerahId = String(selectedNode.daerah_id);
        console.log(`[DashboardOrgChart] Using daerah_id from selectedNode as fallback: ${resolvedDaerahId}`);
      }

      if (!resolvedDaerahId) {
        setSaving(false);
        toast.showWarning('Daerah ID tidak ditemukan untuk node ini. Pastikan data hasil upload sudah lengkap.');
        return;
      }

      // Gunakan fullNodeData jika ada (data lengkap dari database), jika tidak gunakan selectedNode
      const sourceData = fullNodeData || selectedNode;

      // PENTING: SELALU kirim semua field yang mungkin ada di database
      // API sekarang menggunakan VALUES(field) langsung, jadi akan selalu update
      // PERBAIKAN: Pastikan kita selalu gunakan nilai dari editedData jika user sudah edit,
      // jika tidak gunakan dari sourceData (database), jika tidak ada gunakan dari selectedNode
      const getFieldValue = (editedValue: any, sourceValue: any, nodeValue: any): any => {
        // Jika user sudah edit (editedValue !== undefined), gunakan nilai yang di-edit
        if (editedValue !== undefined) {
          // Jika string kosong atau whitespace, kirim null agar bisa di-update ke NULL
          if (typeof editedValue === 'string' && editedValue.trim() === '') {
            return null;
          }
          // Jika null atau undefined, kirim null
          if (editedValue === null || editedValue === undefined) {
            return null;
          }
          // Jika ada isinya, kirim isinya
          return editedValue;
        }
        // Jika belum di-edit, SELALU gunakan dari sourceData (database) jika ada
        // Ini penting agar data yang sudah ada di database tidak hilang
        if (sourceValue !== undefined && sourceValue !== null) {
          // Jika string kosong, kirim null
          if (typeof sourceValue === 'string' && sourceValue.trim() === '') {
            return null;
          }
          return sourceValue;
        }
        // Jika tidak ada di sourceData, gunakan dari selectedNode jika ada
        if (nodeValue !== undefined && nodeValue !== null) {
          // Jika string kosong, kirim null
          if (typeof nodeValue === 'string' && nodeValue.trim() === '') {
            return null;
          }
          return nodeValue;
        }
        // Jika semua kosong, kirim null
        return null;
      };

      const updateData: any = {
        daerah_id: parseInt(resolvedDaerahId),
        id_posisi_sap: selectedNode.id_posisi_sap,
        bulan: parseInt(month),
        tahun: parseInt(year),
        // id_posisi_atasan tidak bisa di-edit, jadi selalu ambil dari sourceData atau selectedNode
        id_posisi_atasan: sourceData.id_posisi_atasan || selectedNode.id_posisi_atasan || null,
        nama: getFieldValue(editedData.nama, sourceData.nama, selectedNode.nama),
        nipp: getFieldValue(editedData.nipp, sourceData.nipp, selectedNode.nipp),
        unit_kerja: getFieldValue(editedData.unit_kerja, sourceData.unit_kerja, selectedNode.unit_kerja),
        direktorat: getFieldValue(editedData.direktorat, sourceData.direktorat, selectedNode.direktorat),
        tingkatan: getFieldValue(editedData.tingkatan, sourceData.tingkatan, selectedNode.tingkatan),
        no_hp: getFieldValue(editedData.no_hp, sourceData.no_hp, selectedNode.no_hp),
        tmt_jabatan: getFieldValue(editedData.tmt_jabatan, sourceData.tmt_jabatan, selectedNode.tmt_jabatan),
        periode_jabatan: getFieldValue(editedData.periode_jabatan, sourceData.periode_jabatan, selectedNode.periode_jabatan),
        kj_individu: getFieldValue(editedData.kj_individu, sourceData.kj_individu, selectedNode.kj_individu),
        kj_posisi: getFieldValue(editedData.kj_posisi, sourceData.kj_posisi, selectedNode.kj_posisi),
        nama_posisi: getFieldValue(editedData.nama_posisi, sourceData.nama_posisi, selectedNode.nama_posisi),
        nama_jabatan_sap: getFieldValue(editedData.nama_jabatan_sap, sourceData.nama_jabatan_sap, selectedNode.nama_jabatan_sap),
        // PENTING: Gunakan photo_url dari selectedNode jika sudah di-upload (local state), 
        // jika tidak gunakan dari sourceData (database), jika tidak ada gunakan dari selectedNode
        photo_url: (selectedNode?.photo_url && selectedNode.photo_url.trim() !== '') 
          ? selectedNode.photo_url 
          : ((sourceData.photo_url && sourceData.photo_url.trim() !== '') 
              ? sourceData.photo_url 
              : ((selectedNode.photo_url && selectedNode.photo_url.trim() !== '') ? selectedNode.photo_url : null)),
      };

      // Log detail semua field untuk debugging
      console.log(`[DashboardOrgChart] ========== SAVING NODE ==========`);
      console.log(`[DashboardOrgChart] Node ID: ${updateData.id_posisi_sap}`);
      console.log(`[DashboardOrgChart] Resolved daerah_id: ${resolvedDaerahId}`);
      console.log(`[DashboardOrgChart] Period: ${updateData.bulan}/${updateData.tahun}`);
      console.log(`[DashboardOrgChart] Full updateData:`, JSON.stringify(updateData, null, 2));
      console.log(`[DashboardOrgChart] selectedNode:`, JSON.stringify(selectedNode, null, 2));
      console.log(`[DashboardOrgChart] fullNodeData:`, JSON.stringify(fullNodeData, null, 2));
      console.log(`[DashboardOrgChart] editedData:`, JSON.stringify(editedData, null, 2));
      console.log(`[DashboardOrgChart] sourceData:`, JSON.stringify(sourceData, null, 2));
      console.log(`[DashboardOrgChart] ==================================`);

      // PERBAIKAN: Tambahkan cache-busting untuk memastikan selalu mengambil data terbaru
      const baseUrlWithCacheBust = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const response = await fetch(baseUrlWithCacheBust, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store',
        body: JSON.stringify({
          daerah_id: updateData.daerah_id,
          bulan: updateData.bulan,
          tahun: updateData.tahun,
          items: [updateData], // Wrap dalam array items sesuai format API
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update selectedNode dengan data baru
        setSelectedNode({
          ...selectedNode,
          ...updateData,
        } as OrgPositionNode);
        setIsEditing(false);
        
        // Refresh data
        await fetchOrgData();
        
        toast.showSuccess("Data berhasil disimpan!");
      } else {
        console.error("[DashboardOrgChart] Save failed:", result);
        alert("Gagal menyimpan: " + (result.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("[DashboardOrgChart] Error saving:", err);
      toast.showError("Gagal menyimpan: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedNode) {
      setEditedData({
        nama: selectedNode.nama,
        nipp: selectedNode.nipp,
        unit_kerja: selectedNode.unit_kerja,
        direktorat: selectedNode.direktorat,
        tingkatan: selectedNode.tingkatan,
        no_hp: selectedNode.no_hp,
        tmt_jabatan: selectedNode.tmt_jabatan,
        periode_jabatan: selectedNode.periode_jabatan,
        kj_individu: selectedNode.kj_individu,
        kj_posisi: selectedNode.kj_posisi,
        nama_posisi: selectedNode.nama_posisi,
        nama_jabatan_sap: selectedNode.nama_jabatan_sap,
      });
    }
    setIsEditing(false);
    setUploadNotice(null);
  };

  const uploadPhoto = useCallback(async (file: File) => {
    if (!selectedNode?.id_posisi_sap) {
      toast.showWarning('Tidak ada node yang dipilih');
      return;
    }

    // Parse periode dari selectedPeriod (format: "bulan-tahun")
    const [monthPart, yearPart] = selectedPeriod.split("-");
    const bulan = monthPart === "all" ? new Date().getMonth() + 1 : parseInt(monthPart);
    const tahun = yearPart === "all" ? new Date().getFullYear() : parseInt(yearPart);

    try {
      setUploadingPhoto(true);
      setUploadNotice(null);
      const fd = new FormData();
      fd.append('id_posisi_sap', selectedNode.id_posisi_sap);
      fd.append('file', file);
      // PERBAIKAN: Jika readOnly=true (mode "Lihat Struktur Organisasi"), langsung save ke database
      // Jika readOnly=false (mode admin), gunakan skip_db_update=true dan tunggu klik "Simpan"
      fd.append('skip_db_update', readOnly ? 'false' : 'true');
      fd.append('bulan', String(bulan));
      fd.append('tahun', String(tahun));
      const resolvedDaerahIdForPhoto =
        daerahId && daerahId !== "all"
          ? daerahId
          : selectedNode.daerah_id
          ? String(selectedNode.daerah_id)
          : null;
      if (resolvedDaerahIdForPhoto) {
        fd.append('daerah_id', resolvedDaerahIdForPhoto);
      }
      
      // Gunakan endpoint yang sesuai dengan divisi
      let apiUrl = '/api/admin/org-positions/photo';
      if (divisi === 'PTP') {
        apiUrl = '/api/admin/ptp-struktur-organisasi/photo';
      } else if (divisi === 'IKT') {
        apiUrl = '/api/admin/ikt-struktur-organisasi/photo';
      } else if (divisi === 'TCU') {
        apiUrl = '/api/admin/tcu-struktur-organisasi/photo';
      }
      
      // PERBAIKAN: Tambahkan cache-busting untuk memastikan selalu mengambil data terbaru
      const apiUrlWithCacheBust = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const res = await fetch(apiUrlWithCacheBust, { 
        method: 'POST', 
        body: fd,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        toast.showError(data.error || 'Gagal upload foto');
      } else {
        const updatedPhotoUrl = data.photo_url;
        
        if (readOnly) {
          // Jika readOnly=true, foto sudah langsung disimpan ke database
          console.log(`[DashboardOrgChart] Uploaded photo file for node ${selectedNode.id_posisi_sap}: ${updatedPhotoUrl} (saved to database immediately)`);
          
          // Refresh data untuk mengambil foto yang baru saja disimpan
          await fetchOrgData();
          
          toast.showSuccess('Foto berhasil diunggah dan disimpan ke database.');
        } else {
          // Jika readOnly=false, foto hanya disimpan ke disk, database akan di-update saat handleSave
          console.log(`[DashboardOrgChart] Uploaded photo file for node ${selectedNode.id_posisi_sap}: ${updatedPhotoUrl} (NOT saved to database yet, waiting for Save)`);
          
          // Update selectedNode dengan photo_url baru
          setSelectedNode((prev) => {
            if (prev) {
              return { ...prev, photo_url: updatedPhotoUrl };
            }
            return prev;
          });
          
          // Update items untuk menampilkan foto baru di chart
          setItems((prev) => prev.map((it) => 
            it.id === selectedNode.id_posisi_sap 
              ? { ...it, photoUrl: updatedPhotoUrl } 
              : it
          ));
          
          setUploadNotice('Foto berhasil diunggah. Klik "Simpan" untuk menyimpan ke database.');
          toast.showSuccess('Foto berhasil diunggah. Klik "Simpan" untuk menyimpan ke database.');
        }
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      toast.showError('Gagal upload foto: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploadingPhoto(false);
    }
  }, [selectedNode, selectedPeriod, daerahId, divisi, readOnly, toast, fetchOrgData]);

  if (!daerahId || daerahId === "0" || daerahId === "" || !selectedPeriod || selectedPeriod === "") {
    console.log(`[DashboardOrgChart] Early return - daerahId: ${daerahId}, selectedPeriod: ${selectedPeriod}`);
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Pilih periode dan daerah untuk melihat struktur organisasi</p>
        <p className="text-xs text-gray-400 mt-2">Debug: daerahId={daerahId}, direktorat={direktoratName || '-'}, period={selectedPeriod}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-600">Memuat struktur organisasi...</p>
        <p className="text-xs text-gray-400 mt-1">Debug: Loading items... (current: {items.length})</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <p className="text-xs text-gray-400 mt-2">Debug: daerahId={daerahId}, direktorat={direktoratName || '-'}, period={selectedPeriod}</p>
      </div>
    );
  }

  // Hapus early return untuk items.length === 0, biarkan render OrgChart meskipun kosong
  // OrgChart akan handle empty state dengan baik

  console.log(`[DashboardOrgChart] Rendering with ${items.length} items - daerahId: ${daerahId}, period: ${selectedPeriod}`);
  
  // Log sample items untuk debugging
  if (items.length > 0) {
    const sampleItem = items[0];
    console.log(`[DashboardOrgChart] Sample item:`, {
      id: sampleItem.id,
      label: sampleItem.label,
      subtitle: sampleItem.subtitle,
      parentId: sampleItem.parentId
    });
  }

  return (
    <>
      <div className="h-full w-full" key={`org-chart-wrapper-${daerahId}-${selectedPeriod}`}>
        <OrgChart
          key={`org-chart-${daerahId}-${selectedPeriod}-${items.length}`}
          ref={orgChartRef}
          items={items}
          divisi={divisi}
          direction="TB"
          onNodeClick={handleNodeClick}
          sortMode="input"
        />
      </div>

      {/* Modal Detail Node */}
      {showModal && selectedNode && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">Detail Posisi</h2>
              <div className="flex items-center gap-2">
                {!readOnly && !isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-white text-blue-600 rounded hover:bg-gray-100 text-sm font-semibold"
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setShowModal(false);
                    setIsEditing(false);
                  }}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-6 mb-6">
                {selectedNode.photo_url ? (
                  <img
                    src={selectedNode.photo_url}
                    alt={selectedNode.nama || "Foto"}
                    className="w-24 h-24 rounded-full object-cover border-4 border-blue-200"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.src = "/icon.jpeg";
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold border-4 border-gray-300">
                    {selectedNode.nama
                      ? selectedNode.nama.slice(0, 2).toUpperCase()
                      : "?"}
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {selectedNode.nama_posisi ||
                      selectedNode.nama_jabatan_sap ||
                      "-"}
                  </h3>
                  {selectedNode.nama ? (
                    <p className="text-lg text-gray-700 mb-1">
                      {selectedNode.nama}
                    </p>
                  ) : (
                    <p className="text-lg text-red-600 font-semibold mb-1">
                      VACANT
                    </p>
                  )}
                  {selectedNode.nipp && (
                    <p className="text-sm text-gray-600">NIPP: {selectedNode.nipp}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.nama || ""}
                      onChange={(e) => setEditedData({ ...editedData, nama: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.nama || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    NIPP
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.nipp || ""}
                      onChange={(e) => setEditedData({ ...editedData, nipp: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.nipp || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama Posisi
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.nama_posisi || ""}
                      onChange={(e) => setEditedData({ ...editedData, nama_posisi: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.nama_posisi || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama Jabatan SAP
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.nama_jabatan_sap || ""}
                      onChange={(e) => setEditedData({ ...editedData, nama_jabatan_sap: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.nama_jabatan_sap || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Unit Kerja
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.unit_kerja || ""}
                      onChange={(e) => setEditedData({ ...editedData, unit_kerja: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.unit_kerja || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Direktorat
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.direktorat || ""}
                      onChange={(e) => setEditedData({ ...editedData, direktorat: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.direktorat || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Tingkatan
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.tingkatan || ""}
                      onChange={(e) => setEditedData({ ...editedData, tingkatan: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.tingkatan || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    No HP
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.no_hp || ""}
                      onChange={(e) => setEditedData({ ...editedData, no_hp: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.no_hp || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    TMT Jabatan
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="date"
                      value={editedData.tmt_jabatan || ""}
                      onChange={(e) => setEditedData({ ...editedData, tmt_jabatan: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.tmt_jabatan || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Periode Jabatan
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.periode_jabatan || ""}
                      onChange={(e) => setEditedData({ ...editedData, periode_jabatan: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.periode_jabatan || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    KJ Individu
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.kj_individu || ""}
                      onChange={(e) => setEditedData({ ...editedData, kj_individu: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Angka atau huruf"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.kj_individu || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    KJ Posisi
                  </label>
                  {isEditing && !readOnly ? (
                    <input
                      type="text"
                      value={editedData.kj_posisi || ""}
                      onChange={(e) => setEditedData({ ...editedData, kj_posisi: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Angka atau huruf"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {selectedNode.kj_posisi || "-"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-end gap-2">
              {isEditing && !readOnly ? (
                <>
                  {uploadNotice && (
                    <div className="mr-auto px-3 py-2 rounded bg-green-50 text-green-700 border border-green-200 text-sm">
                      {uploadNotice}
                    </div>
                  )}
                  <label className="px-4 py-2 bg-indigo-600 text-white rounded cursor-pointer hover:bg-indigo-700 flex items-center gap-2 text-sm font-semibold disabled:opacity-50" style={{ cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}>
                    <FaUpload className="w-5 h-5" />
                    {uploadingPhoto ? 'Mengupload...' : 'Upload/Ganti Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto || saving}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && selectedNode?.id_posisi_sap) {
                          await uploadPhoto(f);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowModal(false);
                    setIsEditing(false);
                    setUploadNotice(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

