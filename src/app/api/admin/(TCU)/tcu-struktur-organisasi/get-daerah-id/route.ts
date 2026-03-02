import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
  port: parseInt(process.env.DB_PORT || '3306'),
};

export async function GET(request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const idPosisiSap = searchParams.get('id_posisi_sap');
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');

    if (!idPosisiSap) {
      return NextResponse.json(
        { success: false, error: 'id_posisi_sap is required' },
        { status: 400 }
      );
    }

    conn = await mysql.createConnection(dbConfig);

    let query = `
      SELECT DISTINCT s.daerah_id, d.nama as daerah_nama
      FROM struktur_organisasi_tcu s
      INNER JOIN daerah d ON s.daerah_id = d.id
      WHERE s.id_posisi_sap = ?
    `;
    const params: any[] = [idPosisiSap];

    // Jika bulan dan tahun diberikan, prioritaskan periode tersebut
    if (bulan && tahun) {
      query += ` AND s.bulan = ? AND s.tahun = ?`;
      params.push(parseInt(bulan), parseInt(tahun));
      query += ` ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1`;
    } else {
      // Ambil yang terbaru jika tidak ada periode
      query += ` ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1`;
    }

    const [rows]: any = await conn.execute(query, params);

    await conn.end();

    if (Array.isArray(rows) && rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          daerah_id: rows[0].daerah_id,
          daerah_nama: rows[0].daerah_nama,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Node tidak ditemukan di database' },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('GET /api/admin/tcu-struktur-organisasi/get-daerah-id error', error);
    if (conn) {
      try {
        await conn.end();
      } catch {}
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch daerah_id' },
      { status: 500 }
    );
  }
}


