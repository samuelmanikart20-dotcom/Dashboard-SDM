// ============================================================
// FILE: src/app/api/admin/upload-mapping-jabatan/route.ts
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const safe = (v: any): string =>
  v !== null && v !== undefined && String(v) !== "nan" ? String(v).trim() : "";

// Normalisasi NPP: buang .0 di belakang
const normNPP = (v: any): string => {
  const s = safe(v);
  if (!s || s === "-" || s === "nan") return "";
  return s.replace(/\.0+$/, "").trim();
};

// Normalisasi nama: uppercase, hapus spasi ganda
const normNama = (v: any): string => {
  const s = safe(v);
  if (!s || s === "-") return "";
  return s.toUpperCase().replace(/\s+/g, " ").trim();
};

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const buffer = Buffer.from(body.file);

    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });

    const allMappings: {
      npp:             string;
      nama:            string;
      jabatan:         string;
      pusat_pelayanan: string;
      non_operasional: string;
    }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw:    false,
      });

      // Cari header row: mengandung "jabatan" atau "nama jabatan"
      let headerIndex = -1;
      for (let i = 0; i < Math.min(raw.length, 15); i++) {
        const joined = raw[i].join("|").toLowerCase();
        if (joined.includes("jabatan") || joined.includes("nama jabatan")) {
          headerIndex = i;
          break;
        }
      }
      if (headerIndex === -1) continue;

      const headers = raw[headerIndex];
      const findIdx = (keys: string[]) =>
        headers.findIndex((h: any) =>
          keys.some((k) => h?.toString().toLowerCase().includes(k.toLowerCase()))
        );

      const idx = {
        npp:            findIdx(["npp", "nip"]),
        // Cari kolom nama pekerja (bukan "nama jabatan")
        nama:           headers.findIndex((h: any) => {
                          const lc = h?.toString().toLowerCase() || "";
                          return lc === "nama" || lc.trim() === "nama";
                        }),
        jabatan:        findIdx(["nama jabatan", "jabatan"]),
        pusatPelayanan: findIdx(["pusat pelayanan"]),
        nonOperasional: findIdx(["operasional/non operasional", "non operasional", "operasional"]),
      };

      if (idx.jabatan === -1) continue;

      // Kalau kolom nama tidak ketemu exact, coba cara lain
      if (idx.nama === -1) {
        // Cari kolom yang isinya nama orang (bukan "nama jabatan")
        const namaIdx = headers.findIndex((h: any) => {
          const lc = h?.toString().toLowerCase() || "";
          return lc.includes("nama") && !lc.includes("jabatan");
        });
        if (namaIdx !== -1) (idx as any).nama = namaIdx;
      }

      for (let i = headerIndex + 1; i < raw.length; i++) {
        const row     = raw[i];
        const jabatan = safe(row[idx.jabatan]);
        if (!jabatan) continue;

        const pusat  = idx.pusatPelayanan !== -1 ? safe(row[idx.pusatPelayanan]) : "";
        const nonOps = idx.nonOperasional !== -1 ? safe(row[idx.nonOperasional]) : "";

        // Skip baris yang tidak punya info pelayanan sama sekali
        if (!pusat && !nonOps) continue;

        allMappings.push({
          npp:             normNPP(idx.npp !== -1 ? row[idx.npp] : ""),
          nama:            normNama(idx.nama !== -1 ? row[(idx as any).nama] : ""),
          jabatan,
          pusat_pelayanan: pusat,
          non_operasional: nonOps,
        });
      }
    }

    if (allMappings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada data mapping yang terbaca. Pastikan file punya kolom: " +
            "Jabatan/Nama Jabatan, Pusat Pelayanan, Operasional/Non Operasional.",
        },
        { status: 400 }
      );
    }

    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || "127.0.0.1",
      user:     process.env.DB_USER     || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME     || "spmt_pelindo_revisi",
      port:     Number(process.env.DB_PORT) || 3307,
    });

    // Pastikan kolom npp dan nama ada di tabel mapping_jabatan
    for (const col of [
      `ALTER TABLE mapping_jabatan ADD COLUMN IF NOT EXISTS npp  VARCHAR(50)  DEFAULT ''`,
      `ALTER TABLE mapping_jabatan ADD COLUMN IF NOT EXISTS nama VARCHAR(255) DEFAULT ''`,
    ]) {
      try { await conn.execute(col); } catch (_) { /* sudah ada */ }
    }

    // Hapus semua mapping lama, ganti dengan yang baru
    await conn.execute(`DELETE FROM mapping_jabatan`);

    for (const m of allMappings) {
      await conn.execute(
        `INSERT INTO mapping_jabatan (npp, nama, jabatan, pusat_pelayanan, non_operasional)
         VALUES (?, ?, ?, ?, ?)`,
        [m.npp, m.nama, m.jabatan, m.pusat_pelayanan, m.non_operasional]
      );
    }

    await conn.end();

    const withNPP  = allMappings.filter((m) => m.npp).length;
    const withNama = allMappings.filter((m) => !m.npp && m.nama).length;
    const withJab  = allMappings.filter((m) => !m.npp && !m.nama).length;

    return NextResponse.json({
      success:     true,
      total:       allMappings.length,
      with_npp:    withNPP,
      with_nama:   withNama,
      with_jabatan_only: withJab,
      message:
        `${allMappings.length} mapping berhasil disimpan ` +
        `(${withNPP} via NPP, ${withNama} via Nama, ${withJab} via Jabatan saja).`,
    });
  } catch (err) {
    console.error("[upload-mapping-jabatan] ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Server error: " + (err as Error).message },
      { status: 500 }
    );
  }
}