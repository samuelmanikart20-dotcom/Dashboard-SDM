import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const runtime = "nodejs";

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "spmt_pelindo_revisi",
    port: Number(process.env.DB_PORT) || 3307,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const idFromParams = awaitedParams?.id;
  const datasetId = Number.parseInt((idFromParams ?? "").trim(), 10);
  if (!Number.isFinite(datasetId)) {
    return NextResponse.json({ error: "Dataset id tidak valid" }, { status: 400 });
  }

  const searchParams = new URL(req.url).searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 200);
  const q = (searchParams.get("q") || "").trim();
  const offset = (page - 1) * limit;

  const conn = await getConnection();
  try {
    // Fetch dataset meta (columns)
    const [dsRows] = await conn.execute(
      "SELECT id, name, columns_json, total_rows FROM storage_datasets WHERE id = ?",
      [datasetId]
    );
    if ((dsRows as any[]).length === 0) {
      return NextResponse.json({ error: "Dataset tidak ditemukan" }, { status: 404 });
    }
    const ds = (dsRows as any)[0];
    const columns: string[] = JSON.parse(ds.columns_json || "[]");

    // Build where for search
    let where = "WHERE dataset_id = ?";
    const paramsArr: any[] = [datasetId];
    if (q) {
      where += " AND data_json LIKE ?";
      paramsArr.push(`%${q}%`);
    }

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM storage_records ${where}`,
      paramsArr
    );
    const total = (countRows as any)[0]?.cnt || 0;

    const [rows] = await conn.execute(
      `SELECT id, data_json, created_at
       FROM storage_records
       ${where}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [...paramsArr, limit, offset]
    );

    const data = (rows as any[]).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      data: JSON.parse(r.data_json || "{}"),
    }));

    return NextResponse.json({
      dataset: { id: ds.id, name: ds.name, columns, total_rows: ds.total_rows },
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      records: data,
    });
  } catch (e: any) {
    console.error("records list error:", e);
    return NextResponse.json({ error: e?.message || "Gagal mengambil records" }, { status: 500 });
  } finally {
    try { await conn.end(); } catch {}
  }
}
