import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spmt_pelindo",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daerahId = searchParams.get("daerah_id");
    const distinct = searchParams.get("distinct");
    const directorate = searchParams.get("direktorat");

    if (!daerahId) {
      return NextResponse.json(
        { success: false, error: "daerah_id is required" },
        { status: 400 }
      );
    }

    const conn = await mysql.createConnection(dbConfig);

    if (distinct === "direktorat") {
      const [rows] = await conn.execute(
        `SELECT DISTINCT direktorat FROM org_position_nodes 
         WHERE daerah_id = ? AND direktorat IS NOT NULL AND TRIM(direktorat) <> ''
         ORDER BY direktorat ASC`,
        [daerahId]
      );
      await conn.end();
      return NextResponse.json({ success: true, data: rows });
    }

    let sql = `SELECT id, daerah_id, id_posisi_sap, id_posisi_atasan, nama_posisi, nama_jabatan_sap, unit_kerja, nipp, nama, tingkatan, direktorat, photo_url
               FROM org_position_nodes WHERE daerah_id = ?`;
    const params: any[] = [daerahId];

    if (directorate) {
      sql += ` AND direktorat = ?`;
      params.push(directorate);
    }

    // Preserve original order by id as import order fallback
    sql += ` ORDER BY id ASC`;

    const [rows] = await conn.execute(sql, params);
    await conn.end();

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET /api/org-positions error", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch" },
      { status: 500 }
    );
  }
}
