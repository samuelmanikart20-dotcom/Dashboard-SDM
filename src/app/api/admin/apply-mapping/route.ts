// ============================================================
// FILE: src/app/api/admin/apply-mapping/route.ts
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

// ── Normalisasi NPP → string bersih tanpa .0 ────────────────
function normNPP(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\.0$/, "").trim();
}

// ── Normalisasi jabatan untuk fallback matching ──────────────
// Hapus kode di depan, lowercase, bersihkan karakter aneh
function normJabatan(raw: string): string {
  if (!raw) return "";
  let s = String(raw).trim();
  // Hapus prefix kode: "80144903 - " atau "JB145529 - "
  s = s.replace(/^[\dA-Za-z]+ - /, "");
  // Normalisasi singkatan umum
  s = s.replace(/\bASM\b/gi, "asisten senior manager");
  s = s.replace(/\bSr\.?\b/gi, "senior");
  s = s.replace(/\bAdm\.?\b/gi, "administrator");
  s = s.replace(/\bStaff\b/gi, "staf");
  s = s.replace(/\bPlt\.?\s*/gi, "");
  s = s.replace(/\bSDM\b/gi, "sumber daya manusia");
  s = s.replace(/\bHSSE\b/gi, "HSE");
  s = s.replace(/\s+/g, " ");
  return s.toLowerCase().trim();
}

// ── Skor matching jabatan (0–1) ──────────────────────────────
function matchScore(a: string, b: string): number {
  const na = normJabatan(a);
  const nb = normJabatan(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = new Set(na.split(/\s+/).filter((w) => w.length >= 3));
  const wb = new Set(nb.split(/\s+/).filter((w) => w.length >= 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  wa.forEach((w) => { if (wb.has(w)) inter++; });
  const union = wa.size + wb.size - inter;
  return inter / union;
}

const JABATAN_THRESHOLD = 0.6;

// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { type, bulan, tahun } = await req.json();

    const bulanMap: Record<string, number> = {
      Januari: 1,   Februari: 2, Maret: 3,    April: 4,
      Mei: 5,       Juni: 6,     Juli: 7,     Agustus: 8,
      September: 9, Oktober: 10, November: 11, Desember: 12,
    };
    const bulanAngka = typeof bulan === "string" ? bulanMap[bulan] : bulan;

    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || "127.0.0.1",
      user:     process.env.DB_USER     || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME     || "spmt_pelindo_revisi",
      port:     Number(process.env.DB_PORT) || 3307,
    });

    const tableMap: Record<string, string> = {
      TCU:  "tcudata",
      PTP:  "ptpdata",
      SPMT: "spmtdata",
      IKT:  "iktdata",
    };

    const table = tableMap[type?.toUpperCase()];
    if (!table) {
      await conn.end();
      return NextResponse.json(
        { success: false, message: `Tipe tidak dikenal: ${type}` },
        { status: 400 }
      );
    }

    // ── Ambil semua mapping ─────────────────────────────────
    const [mappings]: any = await conn.execute(
      `SELECT npp, jabatan, pusat_pelayanan, non_operasional FROM mapping_jabatan`
    );

    if (!mappings || mappings.length === 0) {
      await conn.end();
      return NextResponse.json({
        success: false,
        message: "Tabel mapping_jabatan kosong. Upload file mapping dulu.",
      });
    }

    // Buat lookup cepat: NPP → mapping row
    const nppLookup = new Map<string, any>();
    for (const m of mappings) {
      const npp = normNPP(m.npp);
      if (npp && npp !== "-") {
        nppLookup.set(npp, m);
      }
    }

    // ── Ambil data yang perlu diupdate ─────────────────────
    const [rows]: any = await conn.execute(
      `SELECT id, npp, jabatan, pusat_pelayanan, non_operasional
       FROM ${table}
       WHERE bulan = ? AND tahun = ?`,
      [bulanAngka, tahun]
    );

    let updatedNPP      = 0;
    let updatedJabatan  = 0;
    let skipped         = 0;
    let noMatch         = 0;

    for (const row of rows) {
      // Skip jika sudah terisi keduanya
      if (row.pusat_pelayanan && row.non_operasional) {
        skipped++;
        continue;
      }

      let matched: any = null;
      let method = "";

      // ── STRATEGI 1: Match via NPP (paling akurat) ────────
      const rowNPP = normNPP(row.npp);
      if (rowNPP && nppLookup.has(rowNPP)) {
        matched = nppLookup.get(rowNPP);
        method  = "NPP";
      }

      // ── STRATEGI 2: Fallback match via Jabatan ───────────
      if (!matched) {
        let bestScore = 0;
        for (const m of mappings) {
          const score = matchScore(row.jabatan, m.jabatan);
          if (score > bestScore) {
            bestScore = score;
            matched   = m;
          }
        }
        if (bestScore >= JABATAN_THRESHOLD) {
          method = `jabatan(${bestScore.toFixed(2)})`;
        } else {
          matched = null;
        }
      }

      if (matched) {
        const newPusat  = matched.pusat_pelayanan  || row.pusat_pelayanan  || "";
        const newNonOps = matched.non_operasional  || row.non_operasional  || "";

        await conn.execute(
          `UPDATE ${table}
           SET pusat_pelayanan = ?, non_operasional = ?
           WHERE id = ?`,
          [newPusat, newNonOps, row.id]
        );

        if (method === "NPP") updatedNPP++;
        else updatedJabatan++;

        console.log(`✅ [${method}] NPP=${row.npp} "${row.jabatan}" → pusat="${newPusat}" ops="${newNonOps}"`);
      } else {
        noMatch++;
        console.log(`❌ No match: NPP=${row.npp} "${row.jabatan}"`);
      }
    }

    await conn.end();

    const totalUpdated = updatedNPP + updatedJabatan;

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      updated_by_npp: updatedNPP,
      updated_by_jabatan: updatedJabatan,
      skipped,
      no_match: noMatch,
      total: rows.length,
      message:
        `Selesai. ${totalUpdated} diupdate ` +
        `(${updatedNPP} via NPP, ${updatedJabatan} via jabatan), ` +
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