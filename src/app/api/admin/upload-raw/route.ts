import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

// ===============================
// HELPER FUNCTIONS
// ===============================

const safe = (val: any): string =>
  val !== null && val !== undefined ? val.toString().trim() : "";

const cleanNPP = (val: any): string => {
  if (!val) return "";
  if (typeof val === "number") return String(Math.round(val));
  return val.toString().trim().replace(/\.0+$/, "");
};

const stripKota = (lokasi: string): string => {
  if (!lokasi) return "-";
  const dashIdx = lokasi.indexOf(" - ");
  if (dashIdx !== -1) return lokasi.substring(0, dashIdx).trim();
  return lokasi.trim();
};

const stripNomorJabatan = (jabatan: string): string => {
  if (!jabatan) return "-";
  const match = jabatan.match(/^[\dA-Za-z]+ - (.+)$/);
  if (match) return match[1].trim();
  return jabatan.trim();
};

const fixTanggal = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (!parsed) return null;
    return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    const clean = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.substring(0, 10);
    const parts = clean.split(/[-\/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
      if (c.length === 4) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
  }
  if (val instanceof Date) {
    return `${String(val.getUTCFullYear()).padStart(4, "0")}-${String(val.getUTCMonth() + 1).padStart(2, "0")}-${String(val.getUTCDate()).padStart(2, "0")}`;
  }
  return null;
};

// ✅ PERBAIKAN UTAMA: formatPendidikan sekarang menyimpan nilai asli jika tidak cocok
const formatPendidikan = (val: any): string => {
  if (!val) return "-";
  const raw = val.toString().trim();
  if (!raw || raw === "-") return "-";
  
  const v = raw.toLowerCase();
  if (v.includes("s3") || v.includes("doktor") || v.includes("doctor")) return "S3";
  if (v.includes("s2") || v.includes("magister") || v.includes("master")) return "S2";
  if (v.includes("s1") || v.includes("sarjana")) return "S1";
  if (v.includes("d4")) return "D4";
  if (v.includes("d3") || v.includes("diploma")) return "D3";
  if (v.includes("d2")) return "D2";
  if (v.includes("d1")) return "D1";
  if (v.includes("sma") || v.includes("smk") || v.includes("menengah atas")) return "SMA/SMK";
  if (v.includes("smp") || v.includes("menengah pertama")) return "SMP";
  if (v.includes("sd") || v.includes("sekolah dasar")) return "SD";
  
  // ✅ Jika tidak cocok keyword apapun, simpan nilai asli (bukan "-")
  // Ini mencegah data pendidikan hilang
  return raw.toUpperCase();
};

const formatGender = (val: any): string => {
  if (!val) return "-";
  const v = val.toString().toLowerCase().trim();
  if (v === "male" || v === "laki-laki" || v === "laki laki" || v === "l") return "Laki-laki";
  if (v === "female" || v === "perempuan" || v === "p") return "Perempuan";
  return "-";
};

// ===============================
// ORGANIK / NON ORGANIK
// ===============================
const getOrganikKategori = (
  statusPekerja: string,
  entitas: string,
  npp: string = ""
): { organik: string; kategori: string } => {
  const tag = `(${entitas})`;
  const s = statusPekerja.toLowerCase().trim();
  const digits = npp.replace(/\D/g, "");
  const len = digits.length;

  const isOrganikByStatus =
    s === "regular" ||
    s === "direksi interna" ||
    s === "alihtugas" ||
    s === "alih tugas" ||
    s === "organik" ||
    s === "organic" ||
    s.includes("penugasan");

  const isNonOrganikByStatus =
    s === "pkwt" ||
    s === "pkwtt" ||
    s.includes("alih daya") ||
    s.includes("tad") ||
    s.includes("pemborongan") ||
    s.includes("vendor") ||
    s.includes("external") ||
    s.includes("kontrak");

  let isOrganik: boolean;

  if (len === 6) {
    isOrganik = true;
  } else if (len >= 11) {
    isOrganik = false;
  } else if (isOrganikByStatus) {
    isOrganik = true;
  } else if (isNonOrganikByStatus) {
    isOrganik = false;
  } else {
    isOrganik = false;
  }

  const label = isOrganik ? `Organik ${tag}` : `Non Organik ${tag}`;
  return { organik: label, kategori: label };
};

function fixOrganikIfEmpty(item: any, entitas: string): any {
  const isKosong =
    !item.organik_non_organik ||
    item.organik_non_organik === "" ||
    item.organik_non_organik === "-";

  if (isKosong) {
    const { organik, kategori } = getOrganikKategori(
      item.status_laporan || "",
      entitas,
      item.npp || ""
    );
    return {
      ...item,
      organik_non_organik: organik,
      kategori: !item.kategori || item.kategori === "-" ? kategori : item.kategori,
    };
  }
  return item;
}

// ===============================
// PARSER FORMAT MENTAH
// ===============================
function parseRawFormat(sheet: XLSX.WorkSheet, entitas: string): any[] {
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  let headerIndex = -1;
  for (let i = 0; i < raw.length; i++) {
    const joined = raw[i].join("|").toLowerCase();
    if (
      (joined.includes("nipp") || joined.includes("nip")) &&
      joined.includes("nama")
    ) {
      headerIndex = i;
    }
  }

  if (headerIndex === -1) {
    for (let i = 0; i < raw.length; i++) {
      const joined = raw[i].join("|").toLowerCase();
      if (joined.includes("nama") && joined.includes("jabatan")) {
        headerIndex = i;
      }
    }
  }

  if (headerIndex === -1) {
    console.warn("[parseRawFormat] Header tidak ditemukan!");
    return [];
  }

  const headers = raw[headerIndex];
  console.log("[parseRawFormat] Header baris", headerIndex, ":", headers.slice(0, 20));

  const findIdx = (keys: string[]): number =>
    headers.findIndex((h: any) =>
      keys.some((k) => h?.toString().toLowerCase().includes(k.toLowerCase()))
    );

  const idx = {
    npp: findIdx(["nipp", "nip"]),
    nama: findIdx(["nama"]),
    jabatan: findIdx(["jabatan"]),
    gender: findIdx(["jenis kelamin", "gender"]),
    tanggal: findIdx(["tanggal lahir", "tgl lahir", "tgllahir"]),
    // ✅ PERBAIKAN: tambah lebih banyak variasi nama kolom pendidikan
    pendidikan: findIdx([
      "pendidikan terakhir",
      "pendidikan akhir",
      "pendidikan",
      "tingkat pendidikan",
      "edu",
    ]),
    lokasi: findIdx([
      "lokasi penempatan - kota",
      "lokasi penempatan",
      "penempatan",
      "kota penempatan",
      "unit kerja",
      "lokasi",
    ]),
    statusPekerja: findIdx([
      "status pekerja",
      "statuspekerja",
      "status_pekerja",
      "status",
    ]),
    sdm: findIdx([
      "dihitung kekuatan sdm",
      "kekuatan sdm",
      "dihitung sdm",
      "sdm",
    ]),
  };

  console.log("[parseRawFormat] Kolom index:", idx);

  const results: any[] = [];

  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c: any) => c === "" || c === null)) continue;

    if (idx.sdm !== -1) {
      const sdmVal = safe(row[idx.sdm]).toUpperCase().trim();
      if (sdmVal !== "YA" && sdmVal !== "Y") continue;
    }

    const nama = safe(row[idx.nama]);
    if (!nama || nama.toLowerCase() === "nama") continue;

    const npp = cleanNPP(row[idx.npp]);
    const statusPekerja = idx.statusPekerja !== -1 ? safe(row[idx.statusPekerja]) : "";
    const lokasiRaw = idx.lokasi !== -1 ? safe(row[idx.lokasi]) : "";
    const jabatanRaw = safe(row[idx.jabatan]);

    const { organik, kategori } = getOrganikKategori(statusPekerja, entitas, npp);

    // ✅ Ambil nilai pendidikan dari kolom yang ditemukan
    const pendidikanRaw = idx.pendidikan !== -1 ? safe(row[idx.pendidikan]) : "";
    const pendidikanFinal = formatPendidikan(pendidikanRaw);

    if (results.length < 5) {
      const nDigit = npp.replace(/\D/g, "").length;
      console.log(
        `[RAW] baris=${i} nama="${nama}" npp="${npp}"(${nDigit}d)` +
        ` status="${statusPekerja}" pendidikan="${pendidikanRaw}"→"${pendidikanFinal}" → "${organik}"`
      );
    }

    results.push({
      npp,
      nama,
      jabatan: stripNomorJabatan(jabatanRaw),
      unit_kerja: stripKota(lokasiRaw),
      jenis_kelamin: formatGender(row[idx.gender]),
      kategori,
      organik_non_organik: organik,
      status_laporan: statusPekerja || "-",
      pusat_pelayanan: "",
      non_operasional: "",
      pendidikan: pendidikanFinal,
      tanggal_lahir: fixTanggal(row[idx.tanggal]),
      entitas,
    });
  }

  console.log(`[parseRawFormat] Selesai: ${results.length} baris`);
  return results;
}

// ===============================
// PARSER FORMAT HASIL
// ===============================
function parseResultFormat(sheet: XLSX.WorkSheet, entitas: string): any[] {
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (raw.length < 2) return [];

  let headerIndex = 0;
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const joined = raw[i].join("|").toLowerCase();
    if (joined.includes("nama") && (joined.includes("npp") || joined.includes("nip"))) {
      headerIndex = i;
      break;
    }
  }

  const headers = raw[headerIndex];
  console.log("[parseResultFormat] Header:", headers.slice(0, 15));

  const findIdx = (keys: string[]): number =>
    headers.findIndex((h: any) =>
      keys.some((k) => h?.toString().toLowerCase().includes(k.toLowerCase()))
    );

  const idx = {
    npp: findIdx(["npp", "nip"]),
    nama: findIdx(["nama"]),
    jabatan: findIdx(["jabatan"]),
    gender: findIdx(["jenis kelamin", "gender"]),
    tanggal: findIdx(["tanggal lahir", "tgl lahir"]),
    pendidikan: findIdx([
      "pendidikan terakhir",
      "pendidikan akhir",
      "pendidikan",
      "tingkat pendidikan",
    ]),
    unitKerja: findIdx(["unit kerja", "unitkerja", "lokasi"]),
    kategori: findIdx(["kategori"]),
    organik: findIdx(["organik"]),
    statusLaporan: findIdx(["status laporan", "status pekerja", "status"]),
    pusatPelayanan: findIdx(["pusat pelayanan"]),
    nonOperasional: findIdx(["non operasional", "operasional"]),
  };

  const results: any[] = [];

  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c: any) => c === "" || c === null)) continue;

    const nama = safe(row[idx.nama]);
    if (!nama) continue;

    const npp = cleanNPP(row[idx.npp]);
    const statusLaporan = idx.statusLaporan !== -1 ? safe(row[idx.statusLaporan]) : "";
    let organikFinal = idx.organik !== -1 ? safe(row[idx.organik]) : "";
    let kategoriFinal = idx.kategori !== -1 ? safe(row[idx.kategori]) : "";

    if (!organikFinal || organikFinal === "-" || !kategoriFinal || kategoriFinal === "-") {
      const { organik, kategori } = getOrganikKategori(statusLaporan, entitas, npp);
      if (!organikFinal || organikFinal === "-") organikFinal = organik;
      if (!kategoriFinal || kategoriFinal === "-") kategoriFinal = kategori;
    }

    const unitKerjaRaw = idx.unitKerja !== -1 ? safe(row[idx.unitKerja]) : "-";
    const jabatanRaw = safe(row[idx.jabatan]);
    const pendidikanRaw = idx.pendidikan !== -1 ? safe(row[idx.pendidikan]) : "";

    results.push({
      npp,
      nama,
      jabatan: stripNomorJabatan(jabatanRaw),
      unit_kerja: stripKota(unitKerjaRaw),
      jenis_kelamin: formatGender(row[idx.gender]),
      kategori: kategoriFinal,
      organik_non_organik: organikFinal,
      status_laporan: statusLaporan || "-",
      pusat_pelayanan: idx.pusatPelayanan !== -1 ? safe(row[idx.pusatPelayanan]) : "",
      non_operasional: idx.nonOperasional !== -1 ? safe(row[idx.nonOperasional]) : "",
      pendidikan: formatPendidikan(pendidikanRaw),
      tanggal_lahir: fixTanggal(row[idx.tanggal]),
      entitas,
    });
  }

  console.log(`[parseResultFormat] Selesai: ${results.length} baris`);
  return results;
}

// ===============================
// DETEKSI FORMAT FILE
// ===============================
function detectFormat(workbook: XLSX.WorkBook): "raw" | "result" {
  const sheetNames = workbook.SheetNames;
  const rawSheetNames = ["template", "status pekerja", "dihitung kekuatan sdm"];

  for (const name of sheetNames) {
    if (rawSheetNames.includes(name.toLowerCase())) {
      console.log("[detectFormat] RAW — sheet:", name);
      return "raw";
    }
  }

  const firstSheet = workbook.Sheets[sheetNames[0]];
  if (firstSheet) {
    const firstRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    for (let i = 0; i < Math.min(firstRows.length, 10); i++) {
      const joined = firstRows[i].join("|").toLowerCase();
      if (joined.includes("dihitung") && joined.includes("sdm")) {
        console.log("[detectFormat] RAW — kolom dihitung sdm");
        return "raw";
      }
      if (joined.includes("nipp") || joined.includes("nip / nipp")) {
        console.log("[detectFormat] RAW — kolom NIPP");
        return "raw";
      }
    }
  }

  console.log("[detectFormat] RESULT");
  return "result";
}

// ===============================
// MAIN POST HANDLER
// ===============================
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string)?.toUpperCase() || "TCU";
    const bulan = formData.get("bulan") as string;
    const tahun = formData.get("tahun") as string;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File tidak ditemukan" },
        { status: 400 }
      );
    }

    console.log(`[upload-raw] type=${type} bulan=${bulan} tahun=${tahun} file=${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const format = detectFormat(workbook);

    console.log("[upload-raw] SheetNames:", workbook.SheetNames, "| Format:", format);

    let finalData: any[] = [];

    if (format === "raw") {
      const targetSheet =
        workbook.SheetNames.find((n) => n.toLowerCase() === "template") ||
        workbook.SheetNames[0];

      console.log("[upload-raw] Proses sheet:", targetSheet);
      const sheet = workbook.Sheets[targetSheet];
      const parsed = parseRawFormat(sheet, type);
      finalData.push(...parsed);
    } else {
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const parsed = parseResultFormat(sheet, type);
        finalData.push(...parsed);
      });
    }

    if (finalData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada data yang terbaca. Pastikan:\n" +
            "1. Format file benar\n" +
            "2. Kolom 'Dihitung Kekuatan SDM' terisi 'YA'\n" +
            "3. Sheet bernama 'TEMPLATE' ada di file",
        },
        { status: 400 }
      );
    }

    // FALLBACK: pastikan organik tidak kosong
    finalData = finalData.map((item) => fixOrganikIfEmpty(item, type));

    // ✅ DEBUG: log sample pendidikan
    const pendidikanSample = finalData.slice(0, 5).map(d => ({ nama: d.nama, pendidikan: d.pendidikan }));
    console.log("[upload-raw] Sample pendidikan:", pendidikanSample);

    const kosong = finalData.filter((d) => !d.organik_non_organik || d.organik_non_organik === "").length;
    const organik = finalData.filter((d) => d.organik_non_organik?.startsWith("Organik ")).length;
    const nonOrg = finalData.filter((d) => d.organik_non_organik?.startsWith("Non Organik")).length;
    // ✅ Hitung pendidikan yang berhasil diisi
    const pendidikanTerisi = finalData.filter((d) => d.pendidikan && d.pendidikan !== "-").length;

    console.log(`[upload-raw] Total=${finalData.length} Organik=${organik} NonOrganik=${nonOrg} Kosong=${kosong} PendidikanTerisi=${pendidikanTerisi}`);

    // DATABASE
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "spmt_pelindo_revisi",
      port: Number(process.env.DB_PORT) || 3307,
    });

    const tableMap: Record<string, string> = {
      TCU: "tcudata",
      PTP: "ptpdata",
      SPMT: "spmtdata",
      IKT: "iktdata",
    };

    const table = tableMap[type];
    if (!table) {
      await conn.end();
      return NextResponse.json(
        { success: false, message: `Tipe tidak dikenal: ${type}` },
        { status: 400 }
      );
    }

    // ✅ Pastikan kolom pendidikan ada di tabel
    try {
      await conn.execute(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS pendidikan VARCHAR(100) NULL
      `);
    } catch {
      // Kolom sudah ada, abaikan error
    }

    await conn.execute(
      `DELETE FROM ${table} WHERE bulan=? AND tahun=?`,
      [bulan, tahun]
    );

    for (const item of finalData) {
      await conn.execute(
        `INSERT INTO ${table}
         (npp, nama, jabatan, unit_kerja, jenis_kelamin,
          kategori, organik_non_organik, status_laporan,
          pusat_pelayanan, non_operasional,
          pendidikan, tanggal_lahir, entitas, bulan, tahun,
          created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        [
          item.npp || "",
          item.nama,
          item.jabatan || "-",
          item.unit_kerja,
          item.jenis_kelamin,
          item.kategori,
          item.organik_non_organik,
          item.status_laporan,
          item.pusat_pelayanan,
          item.non_operasional,
          item.pendidikan || "-",
          item.tanggal_lahir,
          item.entitas,
          bulan,
          tahun,
        ]
      );
    }

    await conn.end();

    return NextResponse.json({
      success: true,
      total: finalData.length,
      format_detected: format,
      organik_count: organik,
      non_organik_count: nonOrg,
      pendidikan_terisi: pendidikanTerisi,
      message:
        `Berhasil upload ${finalData.length} data ` +
        `(${format === "raw" ? "Data Mentah" : "Data Hasil"}). ` +
        `Organik: ${organik} | Non Organik: ${nonOrg} | Pendidikan terisi: ${pendidikanTerisi}`,
    });
  } catch (err) {
    console.error("[upload-raw] ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Server error: " + (err as Error).message },
      { status: 500 }
    );
  }
}
