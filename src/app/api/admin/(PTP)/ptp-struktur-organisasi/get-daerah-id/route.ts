import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
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

    let rows: any[] = [];

    // Jika bulan dan tahun diberikan, coba cari untuk periode tersebut terlebih dahulu
    if (bulan && tahun) {
      const bulanInt = parseInt(bulan);
      const tahunInt = parseInt(tahun);
      
      if (!isNaN(bulanInt) && !isNaN(tahunInt)) {
        const query = `
          SELECT DISTINCT s.daerah_id, pd.nama as daerah_nama
          FROM struktur_organisasi_ptp s
          INNER JOIN ptp_daerah pd ON s.daerah_id = pd.id
          WHERE s.id_posisi_sap = ? AND s.bulan = ? AND s.tahun = ?
          ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1
        `;
        const [result]: any = await conn.execute(query, [idPosisiSap, bulanInt, tahunInt]);
        if (Array.isArray(result) && result.length > 0) {
          rows = result;
        }
      }
    }

    // Jika tidak ditemukan untuk periode tertentu, coba cari tanpa filter periode (ambil yang terbaru)
    if (rows.length === 0) {
      const query = `
        SELECT DISTINCT s.daerah_id, pd.nama as daerah_nama
        FROM struktur_organisasi_ptp s
        INNER JOIN ptp_daerah pd ON s.daerah_id = pd.id
        WHERE s.id_posisi_sap = ?
        ORDER BY s.tahun DESC, s.bulan DESC LIMIT 1
      `;
      const [result]: any = await conn.execute(query, [idPosisiSap]);
      if (Array.isArray(result) && result.length > 0) {
        rows = result;
      }
    }

    await conn.end();

    if (rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          daerah_id: rows[0].daerah_id,
          daerah_nama: rows[0].daerah_nama,
        },
      });
    } else {
      // Return 200 dengan success: false, bukan 404, agar frontend bisa handle dengan lebih baik
      return NextResponse.json(
        { success: false, error: 'Node tidak ditemukan di database' },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('GET /api/admin/ptp-struktur-organisasi/get-daerah-id error', error);
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











