import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "spmt_pelindo",
    multipleStatements: true,
  });
}

function normalizeColumns(rows: any[]): string[] {
  const cols = new Set<string>();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => cols.add(String(k))));
  return Array.from(cols);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const name = (form.get("name") as string) || "Dataset Tanpa Nama";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const originalName = (file as any)?.name || "uploaded";
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    // Detect by extension, but use XLSX to handle both CSV and XLSX
    const wb = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "File kosong atau tidak ada data" }, { status: 400 });
    }

    const columns = normalizeColumns(rows);

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const [dsResult] = await conn.execute(
        "INSERT INTO storage_datasets (name, original_filename, columns_json, total_rows) VALUES (?, ?, ?, ?)",
        [name, originalName, JSON.stringify(columns), rows.length]
      );
      const datasetId = (dsResult as any).insertId as number;

      // Batch insert records
      const insertSql = "INSERT INTO storage_records (dataset_id, data_json) VALUES ?";
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const values = chunk.map((r) => [datasetId, JSON.stringify(r)]);
        await (conn as any).query(insertSql, [values]);
      }

      await conn.commit();

      return NextResponse.json({
        success: true,
        dataset: {
          id: datasetId,
          name,
          original_filename: originalName,
          columns,
          total_rows: rows.length,
        },
      });
    } catch (e: any) {
      try { await conn.rollback(); } catch {}
      console.error("Upload storage error:", e);
      return NextResponse.json({ error: e?.message || "Gagal menyimpan dataset" }, { status: 500 });
    } finally {
      try { await conn.end(); } catch {}
    }
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err?.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
