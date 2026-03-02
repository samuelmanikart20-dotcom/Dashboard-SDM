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

    // PERBAIKAN: Pastikan tabel ikt_daerah ada
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS ikt_daerah (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama VARCHAR(255) NOT NULL,
          kode VARCHAR(10) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (err) {
      console.error('[IKT] Error creating ikt_daerah table:', err);
    }
    
    // PERBAIKAN: Cari data dengan prioritas:
    // 1. Jika bulan dan tahun diberikan, cari untuk periode tersebut
    // 2. Jika tidak ditemukan, cari tanpa filter periode (fallback ke data terbaru)
    let query = `
      SELECT DISTINCT s.daerah_id, d.nama as daerah_nama
      FROM struktur_organisasi_ikt s
      INNER JOIN ikt_daerah d ON s.daerah_id = d.id
      WHERE s.id_posisi_sap = ?
    `;
    const params: any[] = [idPosisiSap];

    let rows: any[] = [];

    // Jika bulan dan tahun diberikan, prioritaskan periode tersebut
    if (bulan && tahun) {
      const periodQuery = query + ` AND s.bulan = ? AND s.tahun = ? ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1`;
      const periodParams = [...params, parseInt(bulan), parseInt(tahun)];
      const [periodRows]: any = await conn.execute(periodQuery, periodParams);
      rows = Array.isArray(periodRows) ? periodRows : [];
      
      // Jika tidak ditemukan untuk periode tersebut, cari tanpa filter periode (fallback)
      if (rows.length === 0) {
        const fallbackQuery = query + ` ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1`;
        const [fallbackRows]: any = await conn.execute(fallbackQuery, params);
        rows = Array.isArray(fallbackRows) ? fallbackRows : [];
        if (rows.length > 0) {
          console.log(`[IKT get-daerah-id] Data tidak ditemukan untuk periode ${bulan}/${tahun}, menggunakan data terbaru sebagai fallback`);
        }
      }
    } else {
      // Ambil yang terbaru jika tidak ada periode
      query += ` ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1`;
      const [latestRows]: any = await conn.execute(query, params);
      rows = Array.isArray(latestRows) ? latestRows : [];
    }

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
      // PERBAIKAN: Return 200 dengan success: false, bukan 404, karena ini bukan error endpoint
      return NextResponse.json(
        { success: false, error: 'Node tidak ditemukan di database untuk id_posisi_sap ini' },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('GET /api/admin/(IKT)/ikt-struktur-organisasi/get-daerah-id error', error);
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


