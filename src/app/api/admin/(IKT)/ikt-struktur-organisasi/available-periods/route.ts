import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
  port: parseInt(process.env.DB_PORT || '3306'),
};

export async function GET(_request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(dbConfig);

    // Get distinct periods (bulan, tahun) from struktur_organisasi_ikt
    const [periodRows]: any = await conn.execute(`
      SELECT DISTINCT bulan, tahun
      FROM struktur_organisasi_ikt
      WHERE bulan IS NOT NULL AND tahun IS NOT NULL
      ORDER BY tahun DESC, bulan DESC
    `);

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
    
    // PERBAIKAN: Get distinct daerah from struktur_organisasi_ikt with join to ikt_daerah table (bukan daerah)
    const [daerahRows]: any = await conn.execute(`
      SELECT DISTINCT d.id, d.nama, d.kode
      FROM struktur_organisasi_ikt s
      INNER JOIN ikt_daerah d ON s.daerah_id = d.id
      ORDER BY d.nama ASC
    `);

    // Get distinct directorates directly from struktur_organisasi_ikt
    const [direktoratRows]: any = await conn.execute(`
      SELECT DISTINCT TRIM(direktorat) as direktorat
      FROM struktur_organisasi_ikt
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
    console.error('GET /api/admin/(IKT)/ikt-struktur-organisasi/available-periods error', error);
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


