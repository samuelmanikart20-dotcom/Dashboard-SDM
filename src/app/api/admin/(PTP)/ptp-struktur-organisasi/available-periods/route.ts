import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(_request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(dbConfig);

    // Get distinct periods (bulan, tahun) from struktur_organisasi_ptp
    const [periodRows]: any = await conn.execute(`
      SELECT DISTINCT bulan, tahun
      FROM struktur_organisasi_ptp
      WHERE bulan IS NOT NULL AND tahun IS NOT NULL
      ORDER BY tahun DESC, bulan DESC
    `);

    // Get distinct daerah from struktur_organisasi_ptp with join to ptp_daerah table
    const [daerahRows]: any = await conn.execute(`
      SELECT DISTINCT d.id, d.nama, d.kode
      FROM struktur_organisasi_ptp s
      INNER JOIN ptp_daerah d ON s.daerah_id = d.id
      ORDER BY d.nama ASC
    `);

    // Get distinct directorates directly from struktur_organisasi_ptp
    const [direktoratRows]: any = await conn.execute(`
      SELECT DISTINCT TRIM(direktorat) as direktorat
      FROM struktur_organisasi_ptp
      WHERE direktorat IS NOT NULL AND TRIM(direktorat) != ''
      ORDER BY TRIM(direktorat) ASC
    `);

    // Format periods
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const periods = (periodRows as any[]).map((row: any) => {
      const bulan = row.bulan;
      const tahun = row.tahun;
      const bulanName = monthNames[bulan - 1] || `Bulan ${bulan}`;
      
      return {
        bulan,
        tahun,
        bulanName,
        label: `${bulanName} ${tahun}`,
        value: `${bulan}-${tahun}`,
      };
    });

    // Format daerah
    const daerah = (daerahRows as any[]).map((row: any) => ({
      id: row.id,
      nama: row.nama,
      kode: row.kode,
    }));

    await conn.end();

    return NextResponse.json({
      success: true,
      data: {
        periods,
        daerah,
        directorates: (direktoratRows as any[])
          .filter((row: any) => row?.direktorat)
          .map((row: any) => ({
            value: row.direktorat,
            label: row.direktorat,
          })),
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/(PTP)/ptp-struktur-organisasi/available-periods error', error);
    if (conn) {
      try {
        await conn.end();
      } catch {}
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch available periods and daerah' },
      { status: 500 }
    );
  }
}










