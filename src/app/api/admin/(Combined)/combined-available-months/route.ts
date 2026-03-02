// src/app/api/admin/combined-available-months/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function GET() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "spmt_pelindo",
    });

    // Ambil distinct (bulan,tahun) dari semua tabel
    const q = (t: string) =>
      `SELECT DISTINCT bulan, tahun, COUNT(*) as cnt FROM ${t} GROUP BY bulan, tahun`;
    const [a] = await conn.query(q("spmtdata"));
    const [b] = await conn.query(q("ptpdata"));
    const [c] = await conn.query(q("iktdata"));
    const [d] = await conn.query(q("tcudata"));

    await conn.end();

    const all = [
      ...(a as any[]),
      ...(b as any[]),
      ...(c as any[]),
      ...(d as any[]),
    ];

    // Buat map periode untuk sum cnt
    const map = new Map<
      string,
      { bulan: number; tahun: number; total: number }
    >();
    for (const r of all) {
      const bulan = Number(r.bulan);
      const tahun = Number(r.tahun);

      // Validate bulan is between 1-12
      if (isNaN(bulan) || bulan < 1 || bulan > 12) {
        console.warn(
          `Combined Available Months - Invalid bulan value: ${r.bulan}, skipping`
        );
        continue;
      }

      // Validate tahun is reasonable
      if (isNaN(tahun) || tahun < 2000 || tahun > 2100) {
        console.warn(
          `Combined Available Months - Invalid tahun value: ${r.tahun}, skipping`
        );
        continue;
      }

      const key = `${bulan}-${tahun}`;
      const ex = map.get(key);
      if (ex) ex.total += Number(r.cnt || 0);
      else map.set(key, { bulan, tahun, total: Number(r.cnt || 0) });
    }

    // Buat konsolidasi per tahun
    const yearMap = new Map<number, number>();
    for (const v of map.values()) {
      yearMap.set(v.tahun, (yearMap.get(v.tahun) || 0) + v.total);
    }

    const monthNames = [
      "",
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    // Build periods array with deduplication by value
    const periodMap = new Map<string, any>();

    // 
    //for (const [tahun, total] of yearMap.entries()) {
      //const value = `all-${tahun}`;
      //if (!periodMap.has(value)) {
       // periodMap.set(value, {
        //  bulan: "all" as const,
         // tahun,
          //bulanName: "Konsolidasi",
          //totalRecords: total,
          //label: `Total Data ${tahun} (${total} data)`,
         // value,
         // type: "consolidation" as const,
        //});
      //}
    //}

    // Add monthly periods with deduplication
    for (const v of map.values()) {
      if (v.bulan >= 1 && v.bulan <= 12 && v.tahun >= 2000 && v.tahun <= 2100) {
        const value = `${v.bulan}-${v.tahun}`;
        if (!periodMap.has(value)) {
          const bulanName =
            monthNames[v.bulan] ||
            new Date(2000, v.bulan - 1, 1).toLocaleString("id-ID", {
              month: "long",
            });
          periodMap.set(value, {
            bulan: v.bulan,
            tahun: v.tahun,
            bulanName: bulanName,
            totalRecords: v.total,
            label: `${bulanName} ${v.tahun} (${v.total} data)`,
            value,
            type: "month" as const,
          });
        }
      }
    }

    const periods = Array.from(periodMap.values()).sort((p1, p2) => {
      // Konsolidasi dulu per tahun desc, lalu bulanan desc
      const aKey = (p: any) =>
        p.type === "consolidation"
          ? `Z-${p.tahun}`
          : `${p.tahun}-${String(p.bulan).padStart(2, "0")}`;
      const k1 = aKey(p1);
      const k2 = aKey(p2);
      return k2.localeCompare(k1);
    });

    return NextResponse.json({ success: true, periods });
  } catch (e: any) {
    console.error("combined-available-months error", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Error" },
      { status: 500 }
    );
  }
}
