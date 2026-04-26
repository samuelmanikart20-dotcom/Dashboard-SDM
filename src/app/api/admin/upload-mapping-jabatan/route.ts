// ============================================================
// FILE: src/app/api/admin/upload-mapping-jabatan/route.ts
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const safe = (v: any) =>
  v !== null && v !== undefined && String(v) !== "nan" ? String(v).trim() : "";

// Normalisasi NPP: buang .0 di belakang angka
const normNPP = (v: any): string => {
  const s = safe(v);
  if (!s || s === "-") return "";
  return s.replace(/\.0$/, "").trim();
};

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const buffer = Buffer.from(body.file);

    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });

    // Coba semua sheet, kumpulkan semua baris mapping
    const allMappings: {
      npp: string;
      jabatan: string;
      pusat_pelayanan: string;
      non_operasional: string;
    }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      // Cari baris header (mengandung "jabatan" atau "nama jabatan")
      let headerIndex = -1;
      for (let i = 0; i < Math.min(raw.length, 15); i++) {
        const joined = raw[i].join("|").toLowerCase();
        if (joined.includes("jabatan")) {
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
        jabatan:        findIdx(["nama jabatan", "jabatan"]),
        pusatPelayanan: findIdx(["pusat pelayanan"]),
        nonOperasional: findIdx(["operasional/non operasional", "non operasional", "operasional"]),
      };

      if (idx.jabatan === -1) continue;

      for (let i = headerIndex + 1; i < raw.length; i++) {
        const row     = raw[i];
        const jabatan = safe(row[idx.jabatan]);
        if (!jabatan) continue;

        const pusat  = idx.pusatPelayanan !== -1 ? safe(row[idx.pusatPelayanan]) : "";
        const nonOps = idx.nonOperasional !== -1 ? safe(row[idx.nonOperasional]) : "";

        // Skip baris yang tidak punya info pelayanan
        if (!pusat && !nonOps) continue;

        allMappings.push({
          npp:             idx.npp !== -1 ? normNPP(row[idx.npp]) : "",
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
            "Tidak ada data mapping yang terbaca. Pastikan file punya kolom: Jabatan/Nama Jabatan, Pusat Pelayanan, Operasional/Non Operasional.",
        },
        { status: 400 }
      );
    }

    // ── Pastikan tabel mapping_jabatan punya kolom npp ─────
    // (jalankan sekali, aman diulang)
    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || "127.0.0.1",
      user:     process.env.DB_USER     || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME     || "spmt_pelindo_revisi",
      port:     Number(process.env.DB_PORT) || 3307,
    });

    // Tambah kolom npp jika belum ada (aman diulang)
    try {
      await conn.execute(
        `ALTER TABLE mapping_jabatan ADD COLUMN IF NOT EXISTS npp VARCHAR(50) DEFAULT ''`
      );
    } catch (_) {
      // Abaikan jika kolom sudah ada atau DB tidak support IF NOT EXISTS
    }

    // Bersihkan mapping lama, ganti semua dengan yang baru
    await conn.execute(`DELETE FROM mapping_jabatan`);

    for (const m of allMappings) {
      await conn.execute(
        `INSERT INTO mapping_jabatan (npp, jabatan, pusat_pelayanan, non_operasional)
         VALUES (?, ?, ?, ?)`,
        [m.npp, m.jabatan, m.pusat_pelayanan, m.non_operasional]
      );
    }

    await conn.end();

    const withNPP    = allMappings.filter((m) => m.npp).length;
    const withoutNPP = allMappings.length - withNPP;

    return NextResponse.json({
      success: true,
      total:       allMappings.length,
      with_npp:    withNPP,
      without_npp: withoutNPP,
      message:
        `${allMappings.length} mapping berhasil disimpan ` +
        `(${withNPP} punya NPP, ${withoutNPP} hanya jabatan).`,
    });
  } catch (err) {
    console.error("[upload-mapping-jabatan] ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Server error: " + (err as Error).message },
      { status: 500 }
    );
  }
}