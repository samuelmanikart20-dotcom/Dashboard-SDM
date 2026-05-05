// ============================================================
// FILE: src/app/api/admin/apply-mapping/route.ts
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

// ── Normalisasi NPP ──────────────────────────────────────────
function normNPP(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\.0+$/, "").trim();
}

// ── Normalisasi Nama: uppercase, hapus spasi ganda ───────────
function normNama(v: any): string {
  if (!v) return "";
  return String(v).toUpperCase().replace(/\s+/g, " ").trim();
}

// ── Normalisasi Jabatan untuk fuzzy match ────────────────────
function normJabatan(raw: string): string {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^[\dA-Za-z]+ - /, "");        // hapus kode di depan
  s = s.replace(/\bASM\b/gi,   "asisten senior manager");
  s = s.replace(/\bSr\.?\b/gi, "senior");
  s = s.replace(/\bAdm\.?\b/gi,"administrator");
  s = s.replace(/\bStaff\b/gi, "staf");
  s = s.replace(/\bPlt\.?\s*/gi, "");
  s = s.replace(/\bSDM\b/gi,   "sumber daya manusia");
  s = s.replace(/\bHSSE\b/gi,  "HSE");
  s = s.replace(/\s+/g, " ");
  return s.toLowerCase().trim();
}

// ── Skor Jaccard similarity kata per kata (0–1) ───────────────
function matchScore(a: string, b: string): number {
  const na = normJabatan(a);
  const nb = normJabatan(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = new Set(na.split(/\s+/).filter((w) => w.length >= 3));
  const wb = new Set(nb.split(/\s+/).filter((w) => w.length >= 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  wa.forEach((w) => { if (wb.has(w)) inter++; });
  return inter / (wa.size + wb.size - inter);
}

const JABATAN_THRESHOLD = 0.6;

// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { type, bulan, tahun } = await req.json();

    const bulanMap: Record<string, number> = {
      Januari: 1, Februari: 2, Maret: 3,  April: 4,
      Mei: 5, Juni: 6, Juli: 7, Agustus: 8,
      September: 9, Oktober: 10, November: 11, Desember: 12,
    };
    const bulanAngka = typeof bulan === "string" ? bulanMap[bulan] : Number(bulan);

    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || "127.0.0.1",
      user:     process.env.DB_USER     || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME     || "spmt_pelindo_revisi",
      port:     Number(process.env.DB_PORT) || 3307,
    });

    const tableMap: Record<string, string> = {
      TCU: "tcudata", PTP: "ptpdata", SPMT: "spmtdata", IKT: "iktdata",
    };
    const table = tableMap[type?.toUpperCase()];
    if (!table) {
      await conn.end();
      return NextResponse.json({ success: false, message: `Tipe tidak dikenal: ${type}` }, { status: 400 });
    }

    // ── Ambil semua mapping ──────────────────────────────────
    // Cek apakah kolom 'nama' ada di tabel mapping_jabatan
    let hasMamaCol = false;
    try {
      await conn.execute(`SELECT nama FROM mapping_jabatan LIMIT 1`);
      hasMamaCol = true;
    } catch (_) { /* kolom belum ada */ }

    const selectCols = hasMamaCol
      ? `SELECT npp, nama, jabatan, pusat_pelayanan, non_operasional FROM mapping_jabatan`
      : `SELECT npp, jabatan, pusat_pelayanan, non_operasional FROM mapping_jabatan`;

    const [mappings]: any = await conn.execute(selectCols);

    if (!mappings || mappings.length === 0) {
      await conn.end();
      return NextResponse.json({
        success: false,
        message: "Tabel mapping_jabatan kosong. Upload file mapping dulu.",
      });
    }

    // ── Buat 3 lookup untuk 3 strategi ──────────────────────

    // Lookup 1: NPP → mapping
    const nppLookup = new Map<string, any>();
    for (const m of mappings) {
      const npp = normNPP(m.npp);
      if (npp && npp !== "-") nppLookup.set(npp, m);
    }

    // Lookup 2: NAMA → mapping (hanya baris yang tidak punya NPP)
    const namaLookup = new Map<string, any>();
    if (hasMamaCol) {
      for (const m of mappings) {
        const npp  = normNPP(m.npp);
        const nama = normNama(m.nama);
        // Masukkan ke nama lookup SEMUA yang punya nama — NPP juga bisa fallback via nama
        if (nama) namaLookup.set(nama, m);
      }
    }

    // ── Ambil baris data yang belum punya pusat/operasional ─
    const [rows]: any = await conn.execute(
      `SELECT id, npp, nama, jabatan, pusat_pelayanan, non_operasional
       FROM ${table}
       WHERE bulan = ? AND tahun = ?`,
      [bulanAngka, tahun]
    );

    let updatedNPP     = 0;
    let updatedNama    = 0;
    let updatedJabatan = 0;
    let skipped        = 0;
    let noMatch        = 0;

    for (const row of rows) {
      // Skip jika sudah terisi keduanya
      if (row.pusat_pelayanan && row.non_operasional) {
        skipped++;
        continue;
      }

      let matched: any = null;
      let method = "";

      // ── STRATEGI 1: Match via NPP ────────────────────────
      const rowNPP = normNPP(row.npp);
      if (rowNPP && rowNPP !== "-" && nppLookup.has(rowNPP)) {
        matched = nppLookup.get(rowNPP);
        method  = "NPP";
      }

      // ── STRATEGI 2: Match via NAMA ───────────────────────
      if (!matched && hasMamaCol) {
        const rowNama = normNama(row.nama);
        if (rowNama && namaLookup.has(rowNama)) {
          matched = namaLookup.get(rowNama);
          method  = "Nama";
        }
      }

      // ── STRATEGI 3: Fuzzy match via JABATAN ─────────────
      if (!matched) {
        let bestScore = 0;
        let bestMatch: any = null;
        for (const m of mappings) {
          const score = matchScore(row.jabatan, m.jabatan);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = m;
          }
        }
        if (bestScore >= JABATAN_THRESHOLD) {
          matched = bestMatch;
          method  = `Jabatan(${bestScore.toFixed(2)})`;
        }
      }

      if (matched) {
        const newPusat  = matched.pusat_pelayanan || row.pusat_pelayanan || "";
        const newNonOps = matched.non_operasional || row.non_operasional || "";

        await conn.execute(
          `UPDATE ${table} SET pusat_pelayanan = ?, non_operasional = ? WHERE id = ?`,
          [newPusat, newNonOps, row.id]
        );

        if      (method === "NPP")  updatedNPP++;
        else if (method === "Nama") updatedNama++;
        else                        updatedJabatan++;

        console.log(`✅ [${method}] NPP=${row.npp} Nama="${row.nama}" "${row.jabatan}" → pusat="${newPusat}" ops="${newNonOps}"`);
      } else {
        noMatch++;
        console.log(`❌ No match: NPP=${row.npp} Nama="${row.nama}" Jabatan="${row.jabatan}"`);
      }
    }

    await conn.end();

    const totalUpdated = updatedNPP + updatedNama + updatedJabatan;

    return NextResponse.json({
      success:            true,
      updated:            totalUpdated,
      updated_by_npp:     updatedNPP,
      updated_by_nama:    updatedNama,
      updated_by_jabatan: updatedJabatan,
      skipped,
      no_match:           noMatch,
      total:              rows.length,
      message:
        `Selesai. ${totalUpdated} diupdate ` +
        `(${updatedNPP} via NPP, ${updatedNama} via Nama, ${updatedJabatan} via Jabatan), ` +
        `${skipped} sudah terisi, ${noMatch} tidak ditemukan di mapping.`,
    });

  } catch (err) {
    console.error("[apply-mapping] ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Server error: " + (err as Error).message },
      { status: 500 }
    );
  }
}