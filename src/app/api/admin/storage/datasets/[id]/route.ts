import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const runtime = "nodejs";

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "spmt_pelindo",
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const idStr = (awaitedParams?.id || "").trim();
  const datasetId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(datasetId)) {
    return NextResponse.json({ error: "Dataset id tidak valid" }, { status: 400 });
  }

  const conn = await getConnection();
  try {
    const [result] = await conn.execute("DELETE FROM storage_datasets WHERE id = ?", [datasetId]);
    const affected = (result as any)?.affectedRows || 0;
    if (affected === 0) {
      return NextResponse.json({ error: "Dataset tidak ditemukan" }, { status: 404 });
    }
    // Records are deleted automatically via ON DELETE CASCADE
    return NextResponse.json({ success: true, deletedId: datasetId });
  } catch (e: any) {
    console.error("delete dataset error:", e);
    return NextResponse.json({ error: e?.message || "Gagal menghapus dataset" }, { status: 500 });
  } finally {
    try { await conn.end(); } catch {}
  }
}
