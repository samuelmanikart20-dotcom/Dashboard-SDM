"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import OrgChart, { OrgItem } from "../../../components/OrgChart";
import { useToast } from "@/components/Toast";
import { useAlert } from "@/utils/alert";
import { FaUpload } from "react-icons/fa";

// Helper function untuk format tanggal ke DD/MM/YYYY
function formatDateDisplay(dateValue: string | undefined | null): string {
  if (!dateValue) return "-";

  try {
    const dateStr = String(dateValue).trim();

    // Handle ISO format (2016-06-01T17:00:00.000Z)
    if (dateStr.includes("T")) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }

    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.split("T")[0].split("-");
      return `${day}/${month}/${year}`;
    }

    // Return as is if already in good format
    return dateStr;
  } catch {
    return dateValue || "-";
  }
}

// Props from parent
interface Props {
  selectedBulan: number; // bulan untuk menyimpan data
  selectedTahun: number; // tahun untuk menyimpan data
  divisi?: "SPMT" | "PTP" | "IKT" | "TCU"; // divisi untuk menentukan API endpoint
  onUploadSuccess?: () => void; // callback setelah upload berhasil
  onPeriodChange?: (bulan: number, tahun: number) => void; // callback untuk perubahan periode
}

// Helper function untuk normalisasi direktorat (case-insensitive, trim whitespace)
const normalizeDirektorat = (dir: string | null): string => {
  if (!dir) return "";
  return dir.trim().toUpperCase().replace(/\s+/g, " ");
};

export default function ExcelOrgChart({
  selectedBulan,
  selectedTahun,
  divisi = "SPMT",
  onUploadSuccess,
  onPeriodChange,
}: Props) {
  const toast = useToast();
  const alert = useAlert();
  const [items, setItems] = useState<OrgItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [excelFile, setExcelFile] = useState<File | null>(null); // Simpan file Excel asli
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  // keep metadata per item id for saving and grouping
  const [metaById, setMetaById] = useState<
    Record<
      string,
      {
        tingkatan?: string | null;
        direktorat?: string | null;
        daerah?: string | null;
        originalId?: string;
      }
    >
  >({});
  const [detailNode, setDetailNode] = useState<OrgItem | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<OrgItem>>({});
  const [savingNode, setSavingNode] = useState(false);
  const [daerahId, setDaerahId] = useState<number | null>(null); // Simpan daerah_id dari upload
  const [daerahNama, setDaerahNama] = useState<string | null>(null); // Simpan nama daerah untuk Excel

  // Load items dari localStorage saat component mount
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(`excel-org-items-${divisi}`);
      const savedMetaById = localStorage.getItem(`excel-org-meta-${divisi}`);
      const savedDaerahId = localStorage.getItem(
        `excel-org-daerah-id-${divisi}`
      );
      const savedDaerahNama = localStorage.getItem(
        `excel-org-daerah-nama-${divisi}`
      );
      const savedFileName = localStorage.getItem(
        `excel-org-filename-${divisi}`
      );

      if (savedItems) {
        const parsedItems = JSON.parse(savedItems);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          setItems(parsedItems);
        }
      }

      if (savedMetaById) {
        const parsedMeta = JSON.parse(savedMetaById);
        if (parsedMeta && typeof parsedMeta === "object") {
          setMetaById(parsedMeta);
        }
      }

      if (savedDaerahId) {
        const parsedDaerahId = parseInt(savedDaerahId);
        if (!isNaN(parsedDaerahId)) {
          setDaerahId(parsedDaerahId);
        }
      }

      if (savedDaerahNama) {
        setDaerahNama(savedDaerahNama);
      }

      if (savedFileName) {
        setFileName(savedFileName);
      }
    } catch (err) {
      console.error("Error loading from localStorage:", err);
    }
  }, [divisi]);

  // Simpan items ke localStorage setiap kali items berubah
  useEffect(() => {
    if (items.length > 0) {
      try {
        localStorage.setItem(
          `excel-org-items-${divisi}`,
          JSON.stringify(items)
        );
      } catch (err) {
        console.error("Error saving items to localStorage:", err);
      }
    }
  }, [items, divisi]);

  // Simpan metaById ke localStorage setiap kali metaById berubah
  useEffect(() => {
    if (Object.keys(metaById).length > 0) {
      try {
        localStorage.setItem(
          `excel-org-meta-${divisi}`,
          JSON.stringify(metaById)
        );
      } catch (err) {
        console.error("Error saving metaById to localStorage:", err);
      }
    }
  }, [metaById, divisi]);

  // Simpan daerahId ke localStorage setiap kali daerahId berubah
  useEffect(() => {
    if (daerahId) {
      try {
        localStorage.setItem(`excel-org-daerah-id-${divisi}`, String(daerahId));
      } catch (err) {
        console.error("Error saving daerahId to localStorage:", err);
      }
    }
  }, [daerahId, divisi]);

  // Simpan daerahNama ke localStorage setiap kali daerahNama berubah
  useEffect(() => {
    if (daerahNama) {
      try {
        localStorage.setItem(`excel-org-daerah-nama-${divisi}`, daerahNama);
      } catch (err) {
        console.error("Error saving daerahNama to localStorage:", err);
      }
    }
  }, [daerahNama, divisi]);

  // Simpan fileName ke localStorage setiap kali fileName berubah
  useEffect(() => {
    if (fileName) {
      try {
        localStorage.setItem(`excel-org-filename-${divisi}`, fileName);
      } catch (err) {
        console.error("Error saving fileName to localStorage:", err);
      }
    }
  }, [fileName, divisi]);

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
    const found = items.find((it) => it.id === id);
    setDetailNode(found || null);
  };
  // JANGAN CLEAR ITEMS ketika periode berubah - biarkan node tetap muncul
  // Hanya clear state editing dan selected node
  useEffect(() => {
    // Hanya clear state editing, tapi JANGAN clear items
    // Items tetap muncul meskipun periode berubah
    setSelectedNodeId(null);
    setDetailNode(null);
    setIsEditing(false);
    setEditedData({});
    // JANGAN clear: items, metaById, fileName, errors
  }, [selectedBulan, selectedTahun]);

  // Tidak perlu load dari backend karena user akan upload Excel langsung

  const onFile = useCallback(
    async (file: File) => {
      try {
        setErrors([]);
        setFileName(file.name);
        setExcelFile(file); // Simpan file asli untuk bulk upload
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName)
          throw new Error("Tidak ada sheet yang ditemukan di file Excel.");
        const sheet = wb.Sheets[sheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });
        if (json.length === 0) throw new Error("Sheet pertama kosong.");

        const headers = Object.keys(json[0]);

        // Explicit aliases per provided sample
        const idCol = findColumn(headers, [
          "id posisi sap",
          "id_posisi_sap",
          "idposisisap",
          "posisi sap",
          "posisisap",
          "id posisi",
          "idposisi",
        ]);
        const namaCol = findColumn(headers, ["nama"]);
        const nippCol = findColumn(headers, ["nipp"]);
        const tingkatanCol = findColumn(headers, [
          "tingkatan di bawah direksi",
          "tingkatan dibawah direksi",
          "tingkatandibawahdireksi",
          "tingkatan",
          "bod",
          "bod level",
          "tingkatan dibawah direksi",
        ]);
        const jabatanCol = findColumn(headers, [
          "jabatan",
          "nama posisi",
          "nama jabatan sap",
          "namajabatansap",
          "position",
          "title",
          "nama jabatan",
          "jabatan sap",
        ]);
        const unitCol = findColumn(headers, [
          "unit kerja",
          "unitkerja",
          "unit",
          "departemen",
          "bagian",
          "divisi",
        ]);
        const direktoratCol = findColumn(headers, [
          "direktorat",
          "directorate",
          "dept",
          "division",
        ]);
        const idAtasanCol = findColumn(headers, [
          "id posisi atasan",
          "id_posisi_atasan",
          "idposisiatasan",
          "id atasan",
          "atasan",
          "posisi atasan",
          "posisiatasan",
        ]);
        const daerahCol = findColumn(headers, [
          "daerah",
          "daerah_id",
          "kode daerah",
          "nama daerah",
          "kode_daerah",
          "nama_daerah",
          "region",
          "cabang",
        ]);
        const noHpCol = findColumn(headers, [
          "no hp",
          "no_hp",
          "no. hp",
          "handphone",
          "hp",
          "telepon",
          "no telepon",
          "telepon seluler",
        ]);
        const tmtJabatanCol = findColumn(headers, [
          "tmt jabatan",
          "tmt_jabatan",
          "tmt",
          "terhitung mulai tanggal jabatan",
        ]);
        const periodeJabatanCol = findColumn(headers, [
          "periode jabatan",
          "periode_jabatan",
          "periode",
        ]);
        const kjIndividuCol = findColumn(headers, [
          "kj individu",
          "kj_individu",
          "kjindividu",
        ]);
        const kjPosisiCol = findColumn(headers, [
          "kj posisi",
          "kj_posisi",
          "kjposisi",
        ]);
        const photoCol = findColumn(headers, [
          "photo_url",
          "photo url",
          "photourl",
          "photo",
          "foto",
          "foto_url",
          "foto url",
          "fotourl",
          "PHOTO_URL",
          "PHOTO URL",
        ]);

        const localErrors: string[] = [];
        if (!idCol) localErrors.push("Kolom ID POSISI SAP tidak ditemukan.");
        if (!jabatanCol && !namaCol)
          localErrors.push(
            "Kolom Nama/Jabatan tidak ditemukan (minimal salah satu harus ada)."
          );
        // Kolom ID POSISI ATASAN opsional. Jika tidak ada, semua baris dianggap root/parentId undefined.
        if (localErrors.length) {
          setErrors(localErrors);
          setItems([]);
          setMetaById({});
          return;
        }

        const built: OrgItem[] = [];
        const seen = new Set<string>();
        // Stack/Map to track last seen node per BOD level (1 = highest)
        // const lastSeen = new Map<number, string>();
        const meta: Record<
          string,
          {
            tingkatan?: string | null;
            direktorat?: string | null;
            daerah?: string | null;
            originalId?: string;
          }
        > = {};

        // PERBAIKAN: Untuk SPMT, IKT, PTP, dan TCU, buat map berdasarkan direktorat
        // Map<groupKey, Map<ID_POSISI_SAP, uniqueId>>
        const groupingMap = new Map<string, Map<string, string>>();
        const isSPMT = divisi === "SPMT";
        const isIKT = divisi === "IKT";
        const isPTP = divisi === "PTP";
        const isTCU = divisi === "TCU";
        const useDirektoratGrouping = isSPMT || isIKT || isPTP || isTCU; // SPMT, IKT, PTP, dan TCU menggunakan pengelompokan berdasarkan direktorat

        // Langkah 1: Build map berdasarkan direktorat untuk IKT dan PTP
        if (useDirektoratGrouping && direktoratCol) {
          for (const row of json) {
            const rawId = String(row[idCol!] || "").trim();
            if (!rawId) continue;

            const direktorat = direktoratCol
              ? String(row[direktoratCol] || "").trim()
              : "";
            if (!direktorat) continue;

            // Normalisasi direktorat untuk konsistensi (untuk unique ID)
            const normalizedDirektorat = normalizeDirektorat(direktorat);

            // Buat unique ID: ID_POSISI_SAP|DIREKTORAT (gunakan normalized untuk konsistensi)
            const uniqueId = `${rawId}|${normalizedDirektorat}`;

            // Masukkan ke map berdasarkan direktorat (normalized)
            if (!groupingMap.has(normalizedDirektorat)) {
              groupingMap.set(normalizedDirektorat, new Map());
            }
            groupingMap.get(normalizedDirektorat)!.set(rawId, uniqueId);
          }
        }

        // Untuk non-IKT/PTP/TCU: build idToRow set untuk parent lookup
        const idToRow = useDirektoratGrouping
          ? new Set<string>()
          : new Set(json.map((row) => String(row[idCol!]).trim()));

        // Ambil nama daerah dari baris pertama jika ada kolom DAERAH (untuk default)
        const daerahValues = new Set<string>();
        if (daerahCol && json.length > 0) {
          // Kumpulkan semua nilai daerah yang unik
          for (const row of json) {
            const daerahValue = daerahCol
              ? String(row[daerahCol] || "").trim()
              : "";
            if (daerahValue && daerahValue !== "-") {
              daerahValues.add(daerahValue);
            }
          }

          // Set daerahNama ke nilai pertama yang ditemukan (atau yang paling banyak muncul)
          if (daerahValues.size > 0) {
            const firstDaerahValue = Array.from(daerahValues)[0];
            setDaerahNama(firstDaerahValue);
          }
        }

        // Langkah 2: Build items dengan unique ID dan parent mapping berdasarkan direktorat
        for (const row of json) {
          const rawId = String(row[idCol!]).trim();
          if (!rawId) continue;

          const direktorat = direktoratCol
            ? String(row[direktoratCol] || "").trim()
            : "";

          // Untuk IKT, PTP, dan TCU: buat unique ID dengan format ID_POSISI_SAP|DIREKTORAT
          // Gunakan normalized untuk konsistensi
          let id: string;
          if (useDirektoratGrouping && direktorat) {
            const normalizedDirektorat = normalizeDirektorat(direktorat);
            id = `${rawId}|${normalizedDirektorat}`;
          } else {
            id = rawId;
          }

          if (seen.has(id)) continue;
          seen.add(id);

          // Handle nama dengan lebih teliti untuk deteksi vacant
          let nama = "";
          if (namaCol && row[namaCol] !== null && row[namaCol] !== undefined) {
            const namaStr = String(row[namaCol]).trim();
            // Jika nama adalah "-" atau string kosong setelah trim, anggap sebagai vacant
            nama = namaStr === "-" || namaStr === "" ? "" : namaStr;
          }
          const nipp = nippCol ? String(row[nippCol] || "").trim() : "";
          const jabatan = jabatanCol
            ? String(row[jabatanCol] || "").trim()
            : "";
          const unit = unitCol ? String(row[unitCol] || "").trim() : "";
          const tingkatan = tingkatanCol
            ? String(row[tingkatanCol] || "").trim()
            : "";
          const idAtasan = idAtasanCol
            ? String(row[idAtasanCol] || "").trim()
            : "";
          const photoUrl = photoCol
            ? (() => {
                const v = String(row[photoCol] || "").trim();
                return v && v !== "-" && v !== "" ? v : undefined;
              })()
            : undefined;

          const daerah = daerahCol ? String(row[daerahCol] || "").trim() : "";

          meta[id] = {
            tingkatan: tingkatan || null,
            direktorat: direktorat || null,
            daerah: daerah || null,
            originalId: rawId, // Simpan ID POSISI SAP asli untuk save ke DB
          };

          let parentId: string | undefined = undefined;
          let parentIds: string[] | undefined = undefined;

          // PERBAIKAN: Support multiple parents (dipisahkan dengan ;)
          // Cek apakah idAtasan mengandung separator untuk multiple parents
          const hasMultipleParents = idAtasan.includes(";");

          if (idAtasan) {
            if (hasMultipleParents) {
              // Multiple parents: parse dan validasi setiap parent
              const parentIdList = idAtasan
                .split(";")
                .map((p) => p.trim())
                .filter((p) => p !== "");
              const validParentIds: string[] = [];

              if (useDirektoratGrouping && direktoratCol && direktorat) {
                // Untuk IKT, PTP, dan TCU: cari parent di map direktorat yang sama
                const normalizedDirektorat = normalizeDirektorat(direktorat);
                const mapGroup = groupingMap.get(normalizedDirektorat);

                parentIdList.forEach((pid) => {
                  if (mapGroup && mapGroup.has(pid)) {
                    validParentIds.push(mapGroup.get(pid)!);
                  } else if (idToRow.has(pid)) {
                    // Fallback: cari di idToRow jika tidak ada di mapGroup
                    validParentIds.push(pid);
                  }
                });
              } else {
                // Untuk non-IKT/PTP/TCU: validasi setiap parent di idToRow
                parentIdList.forEach((pid) => {
                  if (idToRow.has(pid)) {
                    validParentIds.push(pid);
                  }
                });
              }

              // Jika ada minimal 2 parents yang valid, gunakan parentIds
              // Jika hanya 1 parent valid, gunakan parentId (backward compatibility)
              if (validParentIds.length >= 2) {
                parentIds = validParentIds;
              } else if (validParentIds.length === 1) {
                parentId = validParentIds[0];
              }
            } else {
              // Single parent: gunakan logika lama
              if (useDirektoratGrouping && direktoratCol && direktorat) {
                // Untuk IKT, PTP, dan TCU: cari parent di map direktorat yang sama (gunakan normalized)
                const normalizedDirektorat = normalizeDirektorat(direktorat);
                const mapGroup = groupingMap.get(normalizedDirektorat);
                if (mapGroup && mapGroup.has(idAtasan)) {
                  // Parent ditemukan di direktorat yang sama
                  parentId = mapGroup.get(idAtasan)!;
                }
                // Jika parent tidak ditemukan di direktorat yang sama, parentId tetap undefined (root)
              } else {
                // Untuk non-IKT/PTP/TCU: gunakan logika lama
                if (idToRow.has(idAtasan)) {
                  parentId = idAtasan;
                }
              }
            }
          }
          // Jika idAtasan kosong atau tidak ditemukan, parentId tetap undefined (root)

          // Untuk vacant: jika nama kosong, label harus kosong atau "-"
          // Jangan fallback ke jabatan agar bisa terdeteksi sebagai vacant
          const label = nama; // Kosong jika nama tidak ada, agar terdeteksi vacant

          built.push({
            id,
            parentId,
            parentIds, // Multiple parents untuk shared subordinate
            label,
            subtitle: jabatan,
            unit,
            nipp,
            positionTitle: jabatan,
            photoUrl: photoUrl,
            badgeColor: "#1E40AF",
            no_hp: noHpCol
              ? (() => {
                  const v = String(row[noHpCol] || "").trim();
                  return v && v !== "-" ? v : undefined;
                })()
              : undefined,
            tmt_jabatan: tmtJabatanCol
              ? (() => {
                  const v = String(row[tmtJabatanCol] || "").trim();
                  return v && v !== "-" ? v : undefined;
                })()
              : undefined,
            periode_jabatan: periodeJabatanCol
              ? (() => {
                  const v = String(row[periodeJabatanCol] || "").trim();
                  return v && v !== "-" ? v : undefined;
                })()
              : undefined,
            kj_individu: kjIndividuCol
              ? (() => {
                  const v = String(row[kjIndividuCol] || "").trim();
                  return v && v !== "-" ? v : undefined;
                })()
              : undefined,
            kj_posisi: kjPosisiCol
              ? (() => {
                  const v = String(row[kjPosisiCol] || "").trim();
                  return v && v !== "-" ? v : undefined;
                })()
              : undefined,
          });
        }

        const clean = built.filter((b) => !!b.id);
        setItems(clean);
        setMetaById(meta);
      } catch (e: any) {
        setErrors([e?.message || "Gagal membaca file Excel."]);
        setItems([]);
        setMetaById({});
      }
    },
    [divisi]
  );

  // const stats = useMemo(() => {
  //   const idSet = new Set(items.map((i) => i.id));
  //   const roots = items.filter(
  //     (i) => !i.parentId || !idSet.has(String(i.parentId))
  //   );
  //   return { total: items.length, roots: roots.length };
  // }, [items]);

  // Group items per division (each BOD-1 starts a new division). If tingkatan is missing, fallback to roots-based grouping.
  const divisions = useMemo(() => {
    if (items.length === 0)
      return [] as Array<{
        title: string;
        directorate?: string | null;
        nodes: OrgItem[];
      }>;

    // Build child map for subtree extraction
    const children = new Map<string, OrgItem[]>();
    items.forEach((it) => {
      if (!it.parentId) return;
      const pid = String(it.parentId);
      if (!children.has(pid)) children.set(pid, []);
      children.get(pid)!.push(it);
    });

    // Find division roots by tingkatan === BOD-1 if available, else roots without parent.
    const roots: OrgItem[] = [];
    const idSet = new Set(items.map((i) => i.id));
    for (const it of items) {
      const meta = metaById[it.id];
      const ting = meta?.tingkatan || "";
      const lvl = parseBodLevel(ting || "");
      if (lvl === 1) roots.push(it);
    }
    if (roots.length === 0) {
      items.forEach((it) => {
        if (!it.parentId || !idSet.has(String(it.parentId))) roots.push(it);
      });
    }

    // DFS to collect subtree for each root
    const collect = (root: OrgItem): OrgItem[] => {
      const result: OrgItem[] = [];
      const stack: OrgItem[] = [root];
      const visited = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur.id)) continue;
        visited.add(cur.id);
        result.push(cur);
        const kids = children.get(cur.id) || [];
        kids.forEach((k) => stack.push(k));
      }
      return result;
    };

    // Build groups with titles: use BOD-1 label as division name, include direktorat and daerah if present on root.
    // PERBAIKAN: Untuk SPMT, IKT, PTP, dan TCU, kelompokkan berdasarkan direktorat, bukan berdasarkan root nodes
    const groups: Array<{
      title: string;
      directorate?: string | null;
      daerah?: string | null;
      nodes: OrgItem[];
    }> = [];
    const isSPMT = divisi === "SPMT";
    const isIKT = divisi === "IKT";
    const isPTP = divisi === "PTP";
    const isTCU = divisi === "TCU";
    const useDirektoratGrouping = isSPMT || isIKT || isPTP || isTCU;

    if (useDirektoratGrouping) {
      // Untuk IKT: Kelompokkan berdasarkan direktorat
      const direktoratGroups = new Map<string, OrgItem[]>();
      const direktoratKeyMap = new Map<string, string>(); // Map untuk normalisasi: normalized -> original

      // Kumpulkan semua nodes per direktorat dengan normalisasi
      items.forEach((it) => {
        const meta = metaById[it.id];
        const dir = meta?.direktorat || null;
        const normalizedKey = dir
          ? normalizeDirektorat(dir)
          : "TANPA DIREKTORAT";

        // Simpan mapping normalized -> original (ambil yang pertama ditemukan)
        if (!direktoratKeyMap.has(normalizedKey) && dir) {
          direktoratKeyMap.set(normalizedKey, dir.trim());
        }

        if (!direktoratGroups.has(normalizedKey)) {
          direktoratGroups.set(normalizedKey, []);
        }
        direktoratGroups.get(normalizedKey)!.push(it);
      });

      // Buat group untuk setiap direktorat
      for (const [normalizedKey, nodes] of direktoratGroups.entries()) {
        // Gunakan original direktorat dari mapping (atau normalized jika tidak ada)
        const originalDirektorat =
          direktoratKeyMap.get(normalizedKey) || normalizedKey;

        // Cari direktorat yang paling umum di dalam nodes ini (untuk title) dengan normalisasi
        const direktoratCounts = new Map<string, number>();
        nodes.forEach((n) => {
          const meta = metaById[n.id];
          const dir = meta?.direktorat || null;
          if (dir) {
            const normalized = normalizeDirektorat(dir);
            direktoratCounts.set(
              normalized,
              (direktoratCounts.get(normalized) || 0) + 1
            );
          }
        });

        // Ambil direktorat yang paling banyak muncul (gunakan original dari mapping)
        let mostCommonDirektorat = originalDirektorat;
        let maxCount = 0;
        for (const [normalizedDir, count] of direktoratCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            const original =
              direktoratKeyMap.get(normalizedDir) || normalizedDir;
            mostCommonDirektorat = original;
          }
        }

        // Cari daerah yang paling umum
        const daerahCounts = new Map<string, number>();
        nodes.forEach((n) => {
          const meta = metaById[n.id];
          const daerah = meta?.daerah || null;
          if (daerah) {
            daerahCounts.set(daerah, (daerahCounts.get(daerah) || 0) + 1);
          }
        });

        let mostCommonDaerah: string | null = null;
        let maxDaerahCount = 0;
        for (const [daerah, count] of daerahCounts.entries()) {
          if (count > maxDaerahCount) {
            maxDaerahCount = count;
            mostCommonDaerah = daerah;
          }
        }

        groups.push({
          title:
            mostCommonDirektorat !== "TANPA DIREKTORAT"
              ? mostCommonDirektorat
              : "Lainnya",
          directorate:
            mostCommonDirektorat !== "TANPA DIREKTORAT"
              ? mostCommonDirektorat
              : null,
          daerah: mostCommonDaerah,
          nodes,
        });
      }
    } else {
      // Untuk non-IKT: gunakan logika lama (berdasarkan root nodes)
      const used = new Set<string>();
      for (const r of roots) {
        if (used.has(r.id)) continue;
        const nodes = collect(r);
        nodes.forEach((n) => used.add(n.id));
        const dir = metaById[r.id]?.direktorat ?? null;
        const daerah = metaById[r.id]?.daerah ?? null;
        const title = r.label || r.id;
        groups.push({ title, directorate: dir, daerah: daerah, nodes });
      }

      // Any remaining nodes not connected (isolated), group them as miscellaneous
      const remaining = items.filter((it) => !used.has(it.id));
      if (remaining.length) {
        // Cari daerah dari node pertama yang tersisa
        const firstRemainingDaerah =
          remaining.length > 0
            ? metaById[remaining[0].id]?.daerah ?? null
            : null;
        groups.push({
          title: "Lainnya",
          directorate: null,
          daerah: firstRemainingDaerah,
          nodes: remaining,
        });
      }
    }

    return groups;
  }, [items, metaById, divisi]);

  // Fungsi untuk membuat file Excel dari items yang ada
  const createExcelFromItems = useCallback(async (): Promise<File | null> => {
    if (items.length === 0) return null;

    try {
      // Pastikan kita punya nama daerah, jika belum ada, fetch dari API
      let currentDaerahNama = daerahNama;
      if (!currentDaerahNama && daerahId) {
        try {
          let apiUrl = "/api/admin/struktur-organisasi/available-periods";
          if (divisi === "PTP") {
            apiUrl = "/api/admin/ptp-struktur-organisasi/available-periods";
          } else if (divisi === "IKT") {
            apiUrl = "/api/admin/ikt-struktur-organisasi/available-periods";
          } else if (divisi === "TCU") {
            apiUrl = "/api/admin/tcu-struktur-organisasi/available-periods";
          }
          const resDaerah = await fetch(apiUrl);
          const jsonDaerah = await resDaerah.json();
          if (jsonDaerah.success && jsonDaerah.data && jsonDaerah.data.daerah) {
            const foundDaerah = jsonDaerah.data.daerah.find(
              (d: any) => d.id === daerahId
            );
            if (foundDaerah) {
              currentDaerahNama = foundDaerah.nama;
              setDaerahNama(currentDaerahNama);
            }
          }
        } catch (err) {
          console.error("Error fetching daerah nama:", err);
        }
      }

      // Jika masih belum ada nama daerah, gunakan placeholder
      if (!currentDaerahNama) {
        currentDaerahNama = "DAERAH"; // Placeholder, akan di-handle oleh backend
        console.warn(
          "[createExcelFromItems] No daerah nama found, using placeholder"
        );
      }

      // Identifikasi items yang tidak memiliki meta.daerah
      const itemsWithoutDaerah = items.filter(
        (item) => !metaById[item.id]?.daerah
      );

      // Fetch daerah dari database untuk items yang tidak memiliki meta.daerah
      const daerahMap: Record<string, string> = {};
      if (itemsWithoutDaerah.length > 0) {
        console.log(
          `[createExcelFromItems] Fetching daerah from database for ${itemsWithoutDaerah.length} items...`
        );

        // Fetch dalam batch (maksimal 50 items untuk performa)
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < itemsWithoutDaerah.length; i += batchSize) {
          batches.push(itemsWithoutDaerah.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const promises = batch.map(async (item) => {
            try {
              // Untuk IKT dan PTP: gunakan originalId (ID POSISI SAP asli) bukan unique ID
              const meta = metaById[item.id] || {};
              const useOriginalId =
                divisi === "IKT" || divisi === "PTP" || divisi === "TCU";
              const idPosisiSap =
                useOriginalId && meta.originalId ? meta.originalId : item.id;

              // Gunakan endpoint yang berbeda untuk SPMT, PTP, dan IKT
              let apiUrl: string;
              if (divisi === "PTP") {
                // PTP menggunakan endpoint terpisah
                apiUrl = `/api/admin/ptp-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
                  idPosisiSap
                )}&bulan=${selectedBulan}&tahun=${selectedTahun}`;
              } else if (divisi === "IKT") {
                // IKT menggunakan endpoint terpisah
                apiUrl = `/api/admin/ikt-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
                  idPosisiSap
                )}&bulan=${selectedBulan}&tahun=${selectedTahun}`;
              } else if (divisi === "TCU") {
                // TCU menggunakan endpoint terpisah
                apiUrl = `/api/admin/tcu-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
                  idPosisiSap
                )}&bulan=${selectedBulan}&tahun=${selectedTahun}`;
              } else {
                // SPMT menggunakan endpoint sendiri
                apiUrl = `/api/admin/org-positions/get-daerah-id?id_posisi_sap=${encodeURIComponent(
                  idPosisiSap
                )}&bulan=${selectedBulan}&tahun=${selectedTahun}`;
              }
              const res = await fetch(apiUrl);
              const json = await res.json();

              if (json.success && json.data && json.data.daerah_nama) {
                daerahMap[item.id] = json.data.daerah_nama;
                return { id: item.id, daerah: json.data.daerah_nama };
              }
            } catch (err) {
              console.error(
                `[createExcelFromItems] Error fetching daerah for ${item.id}:`,
                err
              );
            }
            return null;
          });

          await Promise.all(promises);
        }

        // Update metaById dengan daerah yang di-fetch (untuk next time)
        if (Object.keys(daerahMap).length > 0) {
          setMetaById((prev) => {
            const updated = { ...prev };
            Object.keys(daerahMap).forEach((id) => {
              updated[id] = {
                ...updated[id],
                daerah: daerahMap[id],
              };
            });
            return updated;
          });
        }

        console.log(
          `[createExcelFromItems] Successfully fetched daerah for ${
            Object.keys(daerahMap).length
          } items`
        );
      }

      // Convert items kembali ke format Excel
      const excelData = items.map((item) => {
        const meta = metaById[item.id] || {};
        // Prioritas: 1) meta.daerah, 2) daerahMap (dari database), 3) currentDaerahNama, 4) 'DAERAH'
        const itemDaerah =
          meta.daerah || daerahMap[item.id] || currentDaerahNama || "DAERAH";

        // Untuk IKT dan PTP: gunakan originalId (ID POSISI SAP asli) bukan unique ID
        const useOriginalId =
          divisi === "IKT" || divisi === "PTP" || divisi === "TCU";
        const idPosisiSap =
          useOriginalId && meta.originalId ? meta.originalId : item.id;

        // Untuk ID POSISI ATASAN: jika IKT atau PTP, cari originalId dari parent
        let idPosisiAtasan = item.parentId || "";
        if (useOriginalId && item.parentId) {
          const parentMeta = metaById[item.parentId] || {};
          idPosisiAtasan = parentMeta.originalId || item.parentId;
        }

        return {
          "ID POSISI SAP": idPosisiSap,
          Nama: item.label || "",
          NIPP: item.nipp || "",
          "Tingkatan di Bawah Direksi": meta.tingkatan || "",
          Jabatan: item.subtitle || item.positionTitle || "",
          "Unit Kerja": item.unit || "",
          Direktorat: meta.direktorat || "",
          "ID POSISI ATASAN": idPosisiAtasan,
          "No HP": item.no_hp || "",
          "TMT Jabatan": item.tmt_jabatan || "",
          "Periode Jabatan": item.periode_jabatan || "",
          "KJ Individu": item.kj_individu || "",
          "KJ Posisi": item.kj_posisi || "",
          DAERAH: itemDaerah, // Gunakan daerah dari meta untuk setiap item
          PHOTO_URL: item.photoUrl || "", // PERBAIKAN: Tambahkan photoUrl agar foto yang sudah di-upload ikut tersimpan
        };
      });

      // Debug: Hitung unique daerah values di Excel yang akan di-generate
      const uniqueDaerahInExcel = new Set(excelData.map((row) => row.DAERAH));
      console.log(
        `[createExcelFromItems] Excel will contain ${uniqueDaerahInExcel.size} unique daerah:`,
        Array.from(uniqueDaerahInExcel)
      );

      // Buat workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");

      // Convert ke buffer
      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

      // Convert buffer ke File object
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const generatedFileName =
        fileName ||
        `struktur_organisasi_${selectedBulan}_${selectedTahun}.xlsx`;
      return new File([blob], generatedFileName, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (error) {
      console.error("Error creating Excel from items:", error);
      return null;
    }
  }, [
    items,
    metaById,
    selectedBulan,
    selectedTahun,
    fileName,
    daerahId,
    daerahNama,
    divisi,
  ]);

  const saveToDB = useCallback(async () => {
    if (items.length === 0) {
      toast.showWarning(
        "Tidak ada data untuk disimpan. Upload file Excel terlebih dahulu."
      );
      return;
    }

    // Jika excelFile tidak ada, buat dari items yang ada
    let fileToUpload = excelFile;
    if (!fileToUpload) {
      fileToUpload = await createExcelFromItems();
      if (!fileToUpload) {
        toast.showError(
          "Gagal membuat file Excel dari data yang ada. Silakan upload file Excel terlebih dahulu."
        );
        return;
      }
    }

    setSaving(true);
    try {
      // Gunakan bulk upload API (route groups tidak digunakan di URL)
      let apiUrl = "/api/admin/struktur-organisasi/bulk-upload";
      if (divisi === "PTP") {
        apiUrl = "/api/admin/ptp-struktur-organisasi/bulk-upload";
      } else if (divisi === "IKT") {
        apiUrl = "/api/admin/ikt-struktur-organisasi/bulk-upload";
      } else if (divisi === "TCU") {
        apiUrl = "/api/admin/tcu-struktur-organisasi/bulk-upload";
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("bulan", String(selectedBulan));
      formData.append("tahun", String(selectedTahun));

      // PERBAIKAN: Tambahkan error handling untuk network errors
      let res: Response;
      try {
        res = await fetch(apiUrl, {
          method: "POST",
          body: formData,
        });
      } catch (fetchError: any) {
        // Handle network errors (ERR_INTERNET_DISCONNECTED, dll)
        console.error("[saveToDB] Network error:", fetchError);
        const errorMessage = fetchError.message || "Unknown network error";
        if (
          errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
          errorMessage.includes("Failed to fetch")
        ) {
          toast.showError(
            "Koneksi internet terputus. Pastikan koneksi internet Anda aktif dan coba lagi."
          );
        } else {
          toast.showError(
            `Gagal mengirim data ke server: ${errorMessage}. Pastikan server berjalan dan koneksi internet stabil.`
          );
        }
        setSaving(false);
        return;
      }

      // Cek apakah response adalah JSON atau HTML (error page)
      const contentType = res.headers.get("content-type") || "";
      let data: any;

      try {
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          // Response bukan JSON, kemungkinan error page HTML
          const text = await res.text();
          console.error(
            "Non-JSON response from",
            apiUrl,
            ":",
            text.substring(0, 500)
          );
          toast.showError(
            `Error: Server mengembalikan response yang tidak valid. URL: ${apiUrl}, Status: ${res.status}. Pastikan endpoint API tersedia dan server berjalan dengan benar.`
          );
          setSaving(false);
          return;
        }
      } catch (parseError: any) {
        console.error("[saveToDB] Error parsing response:", parseError);
        toast.showError(
          `Gagal membaca response dari server: ${parseError.message}. Pastikan server berjalan dengan benar.`
        );
        setSaving(false);
        return;
      }

      if (!res.ok || !data?.success) {
        const errorMsg = data?.error || data?.message || "Gagal menyimpan data";
        toast.showError(`Error: ${errorMsg}`);
        return;
      }

      // Tampilkan summary hasil upload
      const summary = data.summary || {};
      const totalBerhasil = summary.total_posisi_berhasil || 0;
      const totalGagal = summary.total_posisi_gagal || 0;

      // Buat detail untuk toast
      const details: string[] = [];
      details.push(`Total daerah: ${summary.total_daerah || 0}`);
      details.push(`Total posisi: ${summary.total_posisi || 0}`);
      details.push(`Posisi berhasil: ${totalBerhasil}`);
      if (totalGagal > 0) {
        details.push(`Posisi gagal: ${totalGagal}`);
      }

      // Tampilkan detail daerah yang berhasil disimpan
      if (summary.daerah_details && summary.daerah_details.length > 0) {
        summary.daerah_details.forEach((d: any) => {
          details.push(
            `${d.daerah_nama || `Daerah ID ${d.daerah_id}`}: ${
              d.total_posisi || 0
            } posisi`
          );
        });
      }

      // Tampilkan error detail jika ada
      if (summary.errors && summary.errors.length > 0) {
        const maxErrors = Math.min(5, summary.errors.length);
        for (let i = 0; i < maxErrors; i++) {
          const err = summary.errors[i];
          const errorMsg = `Row ${err.row || "?"}: ${
            err.error || "Unknown error"
          }`;
          details.push(err.daerah ? `${errorMsg} (${err.daerah})` : errorMsg);
        }
        if (summary.errors.length > maxErrors) {
          details.push(
            `... dan ${summary.errors.length - maxErrors} error lainnya`
          );
        }
      }

      // Tampilkan toast notification
      if (totalGagal > 0) {
        toast.showToast(
          `Upload selesai: ${totalBerhasil} berhasil, ${totalGagal} gagal`,
          'warning',
          8000,
          details
        );
      } else {
        toast.showToast(
          `Upload berhasil! ${totalBerhasil} posisi tersimpan`,
          'success',
          6000,
          details
        );
      }

      // JANGAN reload semua items setelah save - ini menyebabkan items hilang
      // Items yang sudah di-upload dari Excel tetap ada di state
      // Photo URL akan di-update secara individual saat user upload foto per node
      // atau akan muncul otomatis saat user melihat struktur organisasi dari database

      // Panggil callback jika ada data yang berhasil di-insert (meskipun ada error)
      // Ini memungkinkan dropdown filter muncul meskipun ada beberapa error
      // Tambahkan delay untuk memastikan transaction sudah commit ke database
      if (summary.total_posisi_berhasil > 0 && onUploadSuccess) {
        // Delay 800ms untuk memastikan database transaction sudah fully committed
        setTimeout(() => {
          onUploadSuccess();
        }, 800);
      }

      // JANGAN CLEAR ITEMS - biarkan node tetap muncul untuk edit
      // Setelah upload berhasil, ambil daerah_id dari response bulk-upload (yang benar)
      if (
        summary.total_posisi_berhasil > 0 &&
        summary.daerah_details &&
        summary.daerah_details.length > 0
      ) {
        // Ambil daerah_id dari daerah pertama yang berhasil disimpan (biasanya hanya satu daerah per upload)
        const firstDaerahDetail = summary.daerah_details[0];
        if (firstDaerahDetail.daerah_id) {
          setDaerahId(firstDaerahDetail.daerah_id);
        }
        // Simpan nama daerah juga dari response
        if (firstDaerahDetail.daerah_nama) {
          setDaerahNama(firstDaerahDetail.daerah_nama);
        }
      } else if (summary.total_posisi_berhasil > 0) {
        // Fallback: Fetch daerah dari available-periods API jika tidak ada di response
        try {
          let apiUrl = "/api/admin/struktur-organisasi/available-periods";
          if (divisi === "PTP") {
            apiUrl = "/api/admin/ptp-struktur-organisasi/available-periods";
          } else if (divisi === "IKT") {
            apiUrl = "/api/admin/ikt-struktur-organisasi/available-periods";
          } else if (divisi === "TCU") {
            apiUrl = "/api/admin/tcu-struktur-organisasi/available-periods";
          }
          const resDaerah = await fetch(apiUrl);
          const jsonDaerah = await resDaerah.json();
          if (
            jsonDaerah.success &&
            jsonDaerah.data &&
            jsonDaerah.data.daerah &&
            jsonDaerah.data.daerah.length > 0
          ) {
            // Cari daerah yang sesuai dengan daerahNama dari Excel
            const matchingDaerah = jsonDaerah.data.daerah.find(
              (d: any) =>
                d.nama === daerahNama ||
                d.nama.includes(daerahNama || "") ||
                (daerahNama && d.nama.includes(daerahNama))
            );
            const targetDaerah = matchingDaerah || jsonDaerah.data.daerah[0];
            if (!daerahId) {
              setDaerahId(targetDaerah.id);
            }
            // Simpan nama daerah juga
            if (!daerahNama && targetDaerah.nama) {
              setDaerahNama(targetDaerah.nama);
            }
          }
        } catch (err) {
          console.error("Error fetching daerah:", err);
        }
      }

      // Jika ada error, tampilkan error di UI
      if (summary.total_posisi_gagal > 0) {
        // Jika ada error, tampilkan error di UI juga
        const errorMessages =
          summary.errors?.map(
            (err: any) =>
              `Row ${err.row || "?"}: ${err.error || "Unknown error"}`
          ) || [];
        setErrors(errorMessages);
      }
    } catch (error: any) {
      toast.showError(
        "Gagal menyimpan: " + (error?.message || "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }, [
    items,
    excelFile,
    selectedBulan,
    selectedTahun,
    divisi,
    createExcelFromItems,
    daerahId,
    onUploadSuccess,
    daerahNama,
    toast,
  ]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!selectedNodeId) return;

      // SELALU ambil daerah_id dari database berdasarkan id_posisi_sap yang sudah tersimpan
      // Ini lebih akurat daripada menggunakan metaById atau daerahId global
      let currentDaerahId: number | null = null;

      console.log(`[uploadPhoto] Uploading photo for node "${selectedNodeId}"`);
      console.log(
        `[uploadPhoto] Selected period: ${selectedBulan}/${selectedTahun}`
      );

      // Prioritas 1: Ambil daerah_id langsung dari database berdasarkan id_posisi_sap
      try {
        // Untuk IKT dan PTP: gunakan originalId (ID POSISI SAP asli) bukan unique ID
        const meta = metaById[selectedNodeId] || {};
        const useOriginalId =
          divisi === "IKT" || divisi === "PTP" || divisi === "TCU";
        const idPosisiSap =
          useOriginalId && meta.originalId ? meta.originalId : selectedNodeId;

        // Gunakan endpoint yang berbeda untuk SPMT, PTP, dan IKT
        let apiUrl: string;
        if (divisi === "PTP") {
          // PTP menggunakan endpoint terpisah
          apiUrl = `/api/admin/ptp-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
            idPosisiSap
          )}`;
          if (selectedBulan && selectedTahun) {
            apiUrl += `&bulan=${selectedBulan}&tahun=${selectedTahun}`;
          }
        } else if (divisi === "IKT") {
          // IKT menggunakan endpoint terpisah
          apiUrl = `/api/admin/ikt-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
            idPosisiSap
          )}`;
          if (selectedBulan && selectedTahun) {
            apiUrl += `&bulan=${selectedBulan}&tahun=${selectedTahun}`;
          }
        } else if (divisi === "TCU") {
          // TCU menggunakan endpoint terpisah
          apiUrl = `/api/admin/tcu-struktur-organisasi/get-daerah-id?id_posisi_sap=${encodeURIComponent(
            idPosisiSap
          )}`;
          if (selectedBulan && selectedTahun) {
            apiUrl += `&bulan=${selectedBulan}&tahun=${selectedTahun}`;
          }
        } else {
          // SPMT menggunakan endpoint sendiri
          apiUrl = `/api/admin/org-positions/get-daerah-id?id_posisi_sap=${encodeURIComponent(
            idPosisiSap
          )}`;
          if (selectedBulan && selectedTahun) {
            apiUrl += `&bulan=${selectedBulan}&tahun=${selectedTahun}`;
          }
        }

        const resDaerahId = await fetch(apiUrl);
        const jsonDaerahId = await resDaerahId.json();

        if (
          jsonDaerahId.success &&
          jsonDaerahId.data &&
          jsonDaerahId.data.daerah_id
        ) {
          currentDaerahId = jsonDaerahId.data.daerah_id;
          console.log(
            `[uploadPhoto] Found daerah_id ${currentDaerahId} (${jsonDaerahId.data.daerah_nama}) from database for node "${selectedNodeId}"`
          );
        } else {
          console.warn(
            `[uploadPhoto] Node "${selectedNodeId}" not found in database, trying fallback methods`
          );
        }
      } catch (err) {
        console.error("Error fetching daerah_id from database:", err);
      }

      // Prioritas 2: Jika tidak ditemukan di database, coba dari meta data node yang dipilih
      if (!currentDaerahId) {
        const nodeDaerahNama = metaById[selectedNodeId]?.daerah;
        console.log(`[uploadPhoto] Node daerah from meta: "${nodeDaerahNama}"`);

        if (nodeDaerahNama) {
          try {
            let apiUrl = "/api/admin/struktur-organisasi/available-periods";
            if (divisi === "PTP") {
              apiUrl = "/api/admin/ptp-struktur-organisasi/available-periods";
            } else if (divisi === "IKT") {
              apiUrl = "/api/admin/ikt-struktur-organisasi/available-periods";
            }
            const resDaerah = await fetch(apiUrl);
            const jsonDaerah = await resDaerah.json();
            if (
              jsonDaerah.success &&
              jsonDaerah.data &&
              jsonDaerah.data.daerah &&
              jsonDaerah.data.daerah.length > 0
            ) {
              // Cari daerah yang sesuai dengan nama daerah dari node (fleksibel matching)
              const matchingDaerah = jsonDaerah.data.daerah.find((d: any) => {
                const dNama = String(d.nama || "")
                  .trim()
                  .toUpperCase();
                const nodeNama = String(nodeDaerahNama || "")
                  .trim()
                  .toUpperCase();
                // Matching berdasarkan divisi
                if (divisi === "PTP") {
                  return (
                    dNama === nodeNama ||
                    dNama.includes(nodeNama) ||
                    nodeNama.includes(dNama) ||
                    dNama.replace("PTP ", "") ===
                      nodeNama.replace("PTP ", "") ||
                    dNama.replace("PTP", "") === nodeNama.replace("PTP", "") ||
                    d.kode === nodeNama
                  );
                } else {
                  // SPMT
                  return (
                    dNama === nodeNama ||
                    dNama.includes(nodeNama) ||
                    nodeNama.includes(dNama) ||
                    dNama.replace("SPMT ", "") ===
                      nodeNama.replace("SPMT ", "") ||
                    dNama.replace("SPMT", "") ===
                      nodeNama.replace("SPMT", "") ||
                    d.kode === nodeNama
                  );
                }
              });
              if (matchingDaerah) {
                currentDaerahId = matchingDaerah.id;
                console.log(
                  `[uploadPhoto] Found daerah_id ${currentDaerahId} (${matchingDaerah.nama}) from meta for node "${selectedNodeId}" with daerah "${nodeDaerahNama}"`
                );
              }
            }
          } catch (err) {
            console.error("Error fetching daerah:", err);
          }
        }
      }

      // Prioritas 3: Jika tidak ditemukan dari node, coba dari daerahNama global
      if (!currentDaerahId && daerahNama) {
        console.log(`[uploadPhoto] Global daerahNama: "${daerahNama}"`);
        try {
          let apiUrl = "/api/admin/struktur-organisasi/available-periods";
          if (divisi === "PTP") {
            apiUrl = "/api/admin/ptp-struktur-organisasi/available-periods";
          }
          const resDaerah = await fetch(apiUrl);
          const jsonDaerah = await resDaerah.json();
          if (
            jsonDaerah.success &&
            jsonDaerah.data &&
            jsonDaerah.data.daerah &&
            jsonDaerah.data.daerah.length > 0
          ) {
            const matchingDaerah = jsonDaerah.data.daerah.find((d: any) => {
              const dNama = String(d.nama || "")
                .trim()
                .toUpperCase();
              const globalNama = String(daerahNama || "")
                .trim()
                .toUpperCase();
              // Matching berdasarkan divisi
              if (divisi === "PTP") {
                return (
                  dNama === globalNama ||
                  dNama.includes(globalNama) ||
                  globalNama.includes(dNama) ||
                  dNama.replace("PTP ", "") ===
                    globalNama.replace("PTP ", "") ||
                  dNama.replace("PTP", "") === globalNama.replace("PTP", "") ||
                  d.kode === globalNama
                );
              } else {
                // SPMT
                return (
                  dNama === globalNama ||
                  dNama.includes(globalNama) ||
                  globalNama.includes(dNama) ||
                  dNama.replace("SPMT ", "") ===
                    globalNama.replace("SPMT ", "") ||
                  dNama.replace("SPMT", "") ===
                    globalNama.replace("SPMT", "") ||
                  d.kode === globalNama
                );
              }
            });
            if (matchingDaerah) {
              currentDaerahId = matchingDaerah.id;
              console.log(
                `[uploadPhoto] Found daerah_id ${currentDaerahId} (${matchingDaerah.nama}) from global daerahNama "${daerahNama}"`
              );
            }
          }
        } catch (err) {
          console.error("Error fetching daerah:", err);
        }
      }

      // Prioritas 4: Fallback ke daerahId global (jika ada)
      if (!currentDaerahId && daerahId) {
        currentDaerahId = daerahId;
        console.log(`[uploadPhoto] Using global daerahId ${currentDaerahId}`);
      }

      // Prioritas 5: Fetch dari API dan ambil daerah pertama (fallback terakhir)
      if (!currentDaerahId) {
        try {
          let apiUrl = "/api/admin/struktur-organisasi/available-periods";
          if (divisi === "PTP") {
            apiUrl = "/api/admin/ptp-struktur-organisasi/available-periods";
          }
          const resDaerah = await fetch(apiUrl);
          const jsonDaerah = await resDaerah.json();
          if (
            jsonDaerah.success &&
            jsonDaerah.data &&
            jsonDaerah.data.daerah &&
            jsonDaerah.data.daerah.length > 0
          ) {
            currentDaerahId = jsonDaerah.data.daerah[0].id;
            console.log(
              `[uploadPhoto] Using fallback daerah_id ${currentDaerahId} (${jsonDaerah.data.daerah[0].nama})`
            );
          } else {
            toast.showWarning(
              "Daerah ID tidak ditemukan. Silakan upload Excel terlebih dahulu."
            );
            return;
          }
        } catch (err) {
          console.error("Error fetching daerah:", err);
          toast.showError(
            "Gagal mengambil daerah ID. Silakan upload Excel terlebih dahulu."
          );
          return;
        }
      }

      try {
        setUploadingPhoto(true);
        setUploadNotice(null);
        const fd = new FormData();
        // PERBAIKAN: Untuk upload foto tanpa update database, kita hanya perlu id_posisi_sap dan file
        // Tidak perlu daerah_id, bulan, tahun karena tidak akan update database
        // Untuk IKT dan PTP: gunakan originalId (ID POSISI SAP asli) bukan unique ID
        const meta = metaById[selectedNodeId] || {};
        const useOriginalId =
          divisi === "IKT" || divisi === "PTP" || divisi === "TCU";
        const idPosisiSap =
          useOriginalId && meta.originalId ? meta.originalId : selectedNodeId;

        fd.append("id_posisi_sap", idPosisiSap);
        fd.append("file", file);
        // PERBAIKAN: Tambahkan flag skip_db_update agar API hanya save file tanpa update database
        fd.append("skip_db_update", "true");

        // Gunakan endpoint yang sesuai dengan divisi
        let apiUrl = "/api/admin/org-positions/photo";
        if (divisi === "PTP") {
          apiUrl = "/api/admin/ptp-struktur-organisasi/photo";
        } else if (divisi === "IKT") {
          apiUrl = "/api/admin/ikt-struktur-organisasi/photo";
        } else if (divisi === "TCU") {
          apiUrl = "/api/admin/tcu-struktur-organisasi/photo";
        }

        const res = await fetch(apiUrl, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast.showError(data.error || "Gagal upload foto");
        } else {
          // PERBAIKAN: Update lokal saja, database akan di-update saat handleSaveNode
          const updatedPhotoUrl = data.photo_url;
          console.log(
            `[uploadPhoto] Uploaded photo file for node ${selectedNodeId}: ${updatedPhotoUrl} (NOT saved to database yet, waiting for Save)`
          );

          setItems((prev) =>
            prev.map((it) =>
              it.id === selectedNodeId
                ? { ...it, photoUrl: updatedPhotoUrl }
                : it
            )
          );

          // PENTING: Update detailNode dengan photoUrl baru, pertahankan semua field lain
          setDetailNode((prev) => {
            if (prev && prev.id === selectedNodeId) {
              const updated = { ...prev, photoUrl: updatedPhotoUrl } as OrgItem;
              console.log(
                `[uploadPhoto] ========== UPDATED DETAILNODE ==========`
              );
              console.log(`[uploadPhoto] Node ID: ${selectedNodeId}`);
              console.log(`[uploadPhoto] New photoUrl: ${updatedPhotoUrl}`);
              console.log(
                `[uploadPhoto] Updated detailNode:`,
                JSON.stringify(updated, null, 2)
              );
              console.log(
                `[uploadPhoto] =========================================`
              );
              return updated;
            }
            console.warn(
              `[uploadPhoto] detailNode not found or ID mismatch. prev.id=${prev?.id}, selectedNodeId=${selectedNodeId}`
            );
            return prev;
          });

          setUploadNotice(
            'Foto berhasil diunggah. Klik "Simpan" untuk menyimpan ke database.'
          );
          console.log(
            `[uploadPhoto] Photo file uploaded, waiting for handleSaveNode to update database`
          );
        }
      } finally {
        setUploadingPhoto(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedNodeId, divisi, daerahId, selectedBulan, selectedTahun]
  );

  const handleSaveNode = useCallback(async () => {
    console.log(
      `[handleSaveNode] ========== START SAVE NODE (LOCAL ONLY) ==========`
    );
    console.log(`[handleSaveNode] detailNode:`, detailNode);
    console.log(`[handleSaveNode] editedData:`, editedData);

    if (!detailNode) {
      console.error(`[handleSaveNode] ERROR: Missing detailNode`);
      toast.showWarning("Node tidak ditemukan.");
      return;
    }

    // PERBAIKAN: handleSaveNode hanya update state lokal, TIDAK POST ke database
    // Database akan di-update saat user klik "Simpan" (tombol hijau) yang memanggil saveToDB
    setSavingNode(true);
    try {
      // PERBAIKAN: handleSaveNode hanya update state lokal, TIDAK POST ke database
      // Semua perubahan akan disimpan ke database saat user klik "Simpan" (tombol hijau) yang memanggil saveToDB

      // Update items state dengan editedData
      setItems((prev) => {
        const updated = prev.map((it) =>
          it.id === detailNode.id
            ? {
                ...it,
                label:
                  editedData.label !== undefined ? editedData.label : it.label,
                nipp: editedData.nipp !== undefined ? editedData.nipp : it.nipp,
                unit: editedData.unit !== undefined ? editedData.unit : it.unit,
                no_hp:
                  editedData.no_hp !== undefined ? editedData.no_hp : it.no_hp,
                tmt_jabatan:
                  editedData.tmt_jabatan !== undefined
                    ? editedData.tmt_jabatan
                    : it.tmt_jabatan,
                periode_jabatan:
                  editedData.periode_jabatan !== undefined
                    ? editedData.periode_jabatan
                    : it.periode_jabatan,
                kj_individu:
                  editedData.kj_individu !== undefined
                    ? editedData.kj_individu
                    : it.kj_individu,
                kj_posisi:
                  editedData.kj_posisi !== undefined
                    ? editedData.kj_posisi
                    : it.kj_posisi,
                positionTitle:
                  editedData.positionTitle !== undefined
                    ? editedData.positionTitle
                    : it.positionTitle,
                subtitle:
                  editedData.positionTitle !== undefined
                    ? editedData.positionTitle
                    : it.subtitle,
                photoUrl: it.photoUrl, // Photo tetap dari state sebelumnya
                parentId: it.parentId,
                badgeColor: it.badgeColor,
              }
            : it
        );
        console.log(
          `[handleSaveNode] Updated items state locally (NOT saved to database yet)`
        );
        return updated;
      });

      // Update detailNode dengan editedData
      setDetailNode((prev) =>
        prev
          ? ({
              ...prev,
              ...editedData,
              photoUrl: prev.photoUrl, // Photo tetap dari state sebelumnya
            } as OrgItem)
          : null
      );

      setIsEditing(false);
      console.log(`[handleSaveNode] ========== LOCAL SAVE SUCCESS ==========`);
      toast.showSuccess(
        "Perubahan disimpan secara lokal. Klik 'Simpan' di header untuk menyimpan ke database."
      );
    } catch (err: any) {
      console.error("Error saving node:", err);
      toast.showError("Gagal menyimpan: " + (err?.message || "Unknown error"));
    } finally {
      setSavingNode(false);
    }
  }, [
    detailNode,
    editedData,
    toast,
  ]);

  const downloadTemplate = useCallback(() => {
    // Template Excel sesuai format user, dengan kolom DAERAH dan PHOTO_URL di sebelah kanan
    // Urutan: No, Nama, NIPP, Tingkatan di bawah direksi, Jabatan, Unit Kerja, ID POSISI SAP, ID POSISI ATASAN, DIREKTORAT, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, DAERAH, PHOTO_URL
    const csv = [
      [
        "No",
        "Nama",
        "NIPP",
        "Tingkatan di bawah direksi",
        "Jabatan",
        "Unit Kerja",
        "ID POSISI SAP",
        "ID POSISI ATASAN",
        "DIREKTORAT",
        "no_hp",
        "tmt_jabatan",
        "periode_jabatan",
        "kj_individu",
        "kj_posisi",
        "DAERAH",
        "PHOTO_URL",
      ].join(","),
      [
        "1",
        "Sari Santoso",
        "10001 BOD-1",
        "BOD-1",
        "Senior Vice President",
        "Investasi & Layanan",
        "20001",
        "",
        "Direktorat Utama",
        "08227938180",
        "2016-06-02",
        "1 tahun",
        "C",
        "IV",
        "Jakarta",
        "",
      ].join(","),
      [
        "2",
        "Galih Sianipar",
        "10002 BOD-2",
        "BOD-2",
        "Vice President",
        "Keuangan & Akuntansi",
        "20002",
        "20001",
        "Direktorat Keuangan",
        "08581736930",
        "2018-11-26",
        "2 tahun",
        "B",
        "III",
        "Jakarta",
        "",
      ].join(","),
      [
        "3",
        "Yusuf Hasibuan",
        "10003 BOD-3",
        "BOD-3",
        "Manager",
        "Operasi & Komersial",
        "20003",
        "20002",
        "Direktorat Operasi",
        "081234567890",
        "2020-01-15",
        "1 tahun",
        "A",
        "II",
        "Bandung",
        "",
      ].join(","),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_struktur_organisasi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  const tahunOptions = [];
  for (let i = 1950; i <= 2100; i++) {
    tahunOptions.push(i);
  }

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen py-6 px-2 sm:px-6">
      <div className="max-w-5xl space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          {/* Periode Upload Section - Prominent */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-blue-900 mb-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-6 bg-blue-600 rounded mr-2"></span>
                  Upload Struktur Organisasi (Excel)
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pilih periode untuk menyimpan data struktur organisasi
                </p>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
                <label className="text-sm font-semibold text-blue-900 whitespace-nowrap flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Periode Upload:
                </label>
                <select
                  className="border border-blue-300 rounded-md px-3 py-2 text-gray-900 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedBulan}
                  onChange={(e) => {
                    const newBulan = Number(e.target.value);
                    if (onPeriodChange) {
                      onPeriodChange(newBulan, selectedTahun);
                    }
                  }}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="border border-blue-300 rounded-md px-3 py-2 text-gray-900 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedTahun}
                  onChange={(e) => {
                    const newTahun = Number(e.target.value);
                    if (onPeriodChange) {
                      onPeriodChange(selectedBulan, newTahun);
                    }
                  }}
                >
                  {tahunOptions.map((tahun) => (
                    <option key={tahun} value={tahun}>
                      {tahun}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer shadow hover:bg-blue-700 flex items-center gap-2">
              <FaUpload className="w-5 h-5" />
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            <button
              onClick={() => {
                // Alert konfirmasi sebelum menyimpan
                const confirmMessage =
                  `Apakah Anda yakin ingin menyimpan struktur organisasi ${divisi}?\n\n` +
                  `Periode: ${selectedBulan}/${selectedTahun}\n` +
                  `Total posisi: ${items.length}\n\n` +
                  `Data yang sudah tersimpan untuk periode ini akan diganti dengan data baru.`;

                alert.confirm({
                  title: "Konfirmasi Simpan",
                  message: confirmMessage,
                  onConfirm: () => {
                    saveToDB();
                  },
                });
              }}
              disabled={saving || items.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 text-sm font-semibold"
            >
              Unduh Template
            </button>
          </div>
        </div>
        {errors.length > 0 && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm shadow">
            {errors.map((er, i) => (
              <div key={i}>• {er}</div>
            ))}
            <div className="mt-2 text-xs text-red-600">
              Contoh header: "Nama", "NIPP", "Tingkatan di bawah direksi",
              "Jabatan", "Unit Kerja", "Direktorat", "ID POSISI SAP", "ID POSISI
              ATASAN". Kolom "ID POSISI ATASAN" opsional.
            </div>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div>
          {/* Render multiple charts per division, with header actions per div */}
          <div className="space-y-6">
            {divisions.map((div, idx) => {
              // const nodeIds = new Set(div.nodes.map((n) => n.id));
              // const thisDivSelected = selectedNodeId
              //   ? nodeIds.has(selectedNodeId)
              //   : false;
              // PERBAIKAN: Untuk SPMT, IKT, PTP, dan TCU, prioritaskan direktorat sebagai title
              // Untuk non-SPMT/IKT/PTP/TCU, prioritaskan daerah
              const displayTitle =
                divisi === "SPMT" ||
                divisi === "IKT" ||
                divisi === "PTP" ||
                divisi === "TCU"
                  ? div.directorate ||
                    (div as any).daerah ||
                    daerahNama ||
                    "Struktur Organisasi"
                  : (div as any).daerah ||
                    daerahNama ||
                    div.directorate ||
                    "Struktur Organisasi";
              return (
                <div key={idx} className="bg-white border rounded-lg p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div
                        className={`text-sm ${
                          (div as any).daerah || daerahNama
                            ? "font-semibold text-gray-800"
                            : "text-gray-600"
                        }`}
                      >
                        {displayTitle}
                      </div>
                    </div>
                  </div>
                  <OrgChart
                    key={`${selectedBulan}-${selectedTahun}-${
                      div.directorate || "default"
                    }-${idx}`}
                    items={div.nodes}
                    divisi={divisi}
                    direction={"TB"}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              );
            })}
          </div>
          {/* Per division header now has the Upload Foto button; hide the bottom panel to reduce scrolling */}
          {false && selectedNodeId && (
            <div className="mt-3 p-3 border rounded bg-white flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm">
                Upload foto untuk posisi: <b>{selectedNodeId}</b>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 text-sm">
          Unggah file Excel untuk menampilkan bagan.
        </div>
      )}
      {detailNode && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          onClick={() => {
            setDetailNode(null);
            setIsEditing(false);
            setEditedData({});
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">Detail Posisi</h2>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditedData({
                        label: detailNode.label,
                        nipp: detailNode.nipp,
                        unit: detailNode.unit,
                        no_hp: detailNode.no_hp,
                        tmt_jabatan: detailNode.tmt_jabatan,
                        periode_jabatan: detailNode.periode_jabatan,
                        kj_individu: detailNode.kj_individu,
                        kj_posisi: detailNode.kj_posisi,
                        positionTitle:
                          detailNode.positionTitle || detailNode.subtitle,
                        subtitle: detailNode.subtitle,
                      });
                    }}
                    className="px-3 py-1 bg-white text-blue-600 rounded hover:bg-gray-100 text-sm font-semibold"
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setDetailNode(null);
                    setIsEditing(false);
                    setEditedData({});
                  }}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-6 mb-6">
                {detailNode.photoUrl ? (
                  <img
                    src={detailNode.photoUrl}
                    alt={detailNode.label || "Foto"}
                    className="w-24 h-24 rounded-full object-cover border-4 border-blue-200"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.src = "/icon.jpeg";
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold border-4 border-gray-300">
                    {detailNode.label
                      ? detailNode.label.slice(0, 2).toUpperCase()
                      : "?"}
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {detailNode.positionTitle || detailNode.subtitle || "-"}
                  </h3>
                  {detailNode.label ? (
                    <p className="text-lg text-gray-700 mb-1">
                      {detailNode.label}
                    </p>
                  ) : (
                    <p className="text-lg text-red-600 font-semibold mb-1">
                      VACANT
                    </p>
                  )}
                  {detailNode.nipp && (
                    <p className="text-sm text-gray-600">
                      NIPP: {detailNode.nipp}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.label || ""}
                      onChange={(e) =>
                        setEditedData({ ...editedData, label: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.label || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    NIPP
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.nipp || ""}
                      onChange={(e) =>
                        setEditedData({ ...editedData, nipp: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.nipp || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama Posisi
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={
                        editedData.positionTitle ||
                        detailNode.positionTitle ||
                        detailNode.subtitle ||
                        ""
                      }
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          positionTitle: e.target.value,
                          subtitle: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.positionTitle || detailNode.subtitle || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Nama Jabatan SAP
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={
                        editedData.positionTitle ||
                        detailNode.positionTitle ||
                        detailNode.subtitle ||
                        ""
                      }
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          positionTitle: e.target.value,
                          subtitle: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.positionTitle || detailNode.subtitle || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Unit Kerja
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.unit || ""}
                      onChange={(e) =>
                        setEditedData({ ...editedData, unit: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.unit || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Direktorat
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={metaById[detailNode.id]?.direktorat || ""}
                      onChange={(e) => {
                        // Update metaById untuk direktorat
                        setMetaById((prev) => ({
                          ...prev,
                          [detailNode.id]: {
                            ...prev[detailNode.id],
                            direktorat: e.target.value,
                          },
                        }));
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {metaById[detailNode.id]?.direktorat || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Tingkatan
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={metaById[detailNode.id]?.tingkatan || ""}
                      onChange={(e) => {
                        // Update metaById untuk tingkatan
                        setMetaById((prev) => ({
                          ...prev,
                          [detailNode.id]: {
                            ...prev[detailNode.id],
                            tingkatan: e.target.value,
                          },
                        }));
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {metaById[detailNode.id]?.tingkatan || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    No HP
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.no_hp || ""}
                      onChange={(e) =>
                        setEditedData({ ...editedData, no_hp: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.no_hp || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    TMT Jabatan
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={
                        editedData.tmt_jabatan
                          ? editedData.tmt_jabatan.includes("T")
                            ? editedData.tmt_jabatan.split("T")[0]
                            : editedData.tmt_jabatan
                          : detailNode.tmt_jabatan
                          ? detailNode.tmt_jabatan.includes("T")
                            ? detailNode.tmt_jabatan.split("T")[0]
                            : detailNode.tmt_jabatan
                          : ""
                      }
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          tmt_jabatan: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {formatDateDisplay(detailNode.tmt_jabatan)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Periode Jabatan
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.periode_jabatan || ""}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          periode_jabatan: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.periode_jabatan || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    KJ Individu
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.kj_individu || ""}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          kj_individu: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Angka atau huruf"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.kj_individu || "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    KJ Posisi
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.kj_posisi || ""}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          kj_posisi: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Angka atau huruf"
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">
                      {detailNode.kj_posisi || "-"}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2">
              {isEditing ? (
                <>
                  {uploadNotice && (
                    <div className="mr-auto px-3 py-2 rounded bg-green-50 text-green-700 border border-green-200 text-sm">
                      {uploadNotice}
                    </div>
                  )}
                  <label
                    className="px-4 py-2 bg-indigo-600 text-white rounded cursor-pointer hover:bg-indigo-700 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                    style={{
                      cursor: uploadingPhoto ? "not-allowed" : "pointer",
                    }}
                  >
                    <svg width="18" height="18" fill="none">
                      <path
                        d="M9 1v10m0 0l-3-3m3 3l3-3"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {uploadingPhoto ? "Mengupload..." : "Upload/Ganti Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto || savingNode}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && detailNode?.id) {
                          setSelectedNodeId(detailNode.id);
                          await uploadPhoto(f);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedData({});
                    }}
                    disabled={savingNode}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      console.log(
                        `[Save Button] ========== CLICKED ==========`
                      );
                      console.log(
                        `[Save Button] Clicked! detailNode:`,
                        detailNode
                      );
                      console.log(
                        `[Save Button] detailNode.photoUrl:`,
                        detailNode?.photoUrl
                      );
                      console.log(`[Save Button] daerahId:`, daerahId);
                      console.log(
                        `[Save Button] selectedBulan:`,
                        selectedBulan
                      );
                      console.log(
                        `[Save Button] selectedTahun:`,
                        selectedTahun
                      );
                      if (!detailNode || !daerahId) {
                        console.error(
                          `[Save Button] ERROR: Cannot save - missing detailNode or daerahId`
                        );
                        toast.showWarning(
                          "Tidak dapat menyimpan: detailNode atau daerahId tidak ditemukan. Silakan upload Excel terlebih dahulu."
                        );
                        return;
                      }
                      console.log(`[Save Button] Calling handleSaveNode...`);
                      handleSaveNode();
                    }}
                    disabled={savingNode}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingNode
                      ? "Menyimpan..."
                      : `Simpan (${selectedBulan}-${selectedTahun})`}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setDetailNode(null);
                      setIsEditing(false);
                      setEditedData({});
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Tutup
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <alert.AlertComponent />
    </div>
  );
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const nmap = new Map(headers.map((h) => [normalizeHeader(h), h]));
  for (const a of aliases) {
    const n = normalizeHeader(a);
    if (nmap.has(n)) return nmap.get(n)!;
  }
  // Fallback: try contains
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (aliases.some((a) => n.includes(normalizeHeader(a)))) return h;
  }
  return null;
}

function parseBodLevel(text: string): number | null {
  if (!text) return null;
  const m = /bod\s*-?\s*(\d+)/i.exec(text);
  if (m && m[1]) {
    const n = parseInt(m[1], 10);
    return isNaN(n) ? null : n;
  }
  return null;
}
