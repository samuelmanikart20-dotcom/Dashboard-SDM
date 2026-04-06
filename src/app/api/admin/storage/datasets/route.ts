import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const runtime = "nodejs";

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "spmt_pelindo_revisi",
    port: Number(process.env.DB_PORT) || 3307
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 100);
  const q = (searchParams.get("q") || "").trim();
  const offset = (page - 1) * limit;

  const conn = await getConnection();
  try {
    let where = "";
    const params: any[] = [];
    if (q) {
      where = "WHERE name LIKE ? OR original_filename LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }

    const [rows] = await conn.execute(
      `SELECT id, name, original_filename, columns_json, total_rows, created_at
       FROM storage_datasets ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM storage_datasets ${where}`,
      params
    );

    const total = (countRows as any)[0]?.cnt || 0;

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: (rows as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        original_filename: r.original_filename,
        columns: JSON.parse(r.columns_json || "[]"),
        total_rows: r.total_rows,
        created_at: r.created_at,
      })),
    });
  } catch (e: any) {
    console.error("datasets list error:", e);
    return NextResponse.json({ error: e?.message || "Gagal mengambil datasets" }, { status: 500 });
  } finally {
    try { await conn.end(); } catch {}
  }
}
