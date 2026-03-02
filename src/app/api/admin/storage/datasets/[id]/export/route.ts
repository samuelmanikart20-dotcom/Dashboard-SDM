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
  });
}

function toCSV(rows: any[], columns: string[]): string {
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(",")).join("\n");
  return header + "\n" + body;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const datasetId = Number.parseInt(
    (awaitedParams?.id || "").trim() || "",
    10
  );
  if (!Number.isFinite(datasetId)) {
    return NextResponse.json({ error: "Dataset id tidak valid" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();

  const conn = await getConnection();
  try {
    const [dsRows] = await conn.execute(
      "SELECT id, name, columns_json, total_rows FROM storage_datasets WHERE id = ?",
      [datasetId]
    );
    if ((dsRows as any[]).length === 0) {
      return NextResponse.json({ error: "Dataset tidak ditemukan" }, { status: 404 });
    }
    const ds = (dsRows as any)[0];
    const columns: string[] = JSON.parse(ds.columns_json || "[]");

    // Fetch all records (export usually intentional; for very large datasets, you may stream or page)
    const [recRows] = await conn.execute(
      "SELECT data_json FROM storage_records WHERE dataset_id = ? ORDER BY id ASC",
      [datasetId]
    );
    const data = (recRows as any[]).map((r) => JSON.parse(r.data_json || "{}"));

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data, { header: columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new Response(out as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="dataset_${datasetId}.xlsx"`,
        },
      });
    }

    // default CSV
    const csv = toCSV(data, columns);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dataset_${datasetId}.csv"`,
      },
    });
  } catch (e: any) {
    console.error("export error:", e);
    return NextResponse.json({ error: e?.message || "Gagal mengekspor dataset" }, { status: 500 });
  } finally {
    try { await conn.end(); } catch {}
  }
}
