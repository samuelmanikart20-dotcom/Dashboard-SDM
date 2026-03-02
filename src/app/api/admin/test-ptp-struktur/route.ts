import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(_request: NextRequest) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Test direct query to ptp_struktur_organisasi
      const [allStruktur] = await connection.execute(`
        SELECT * FROM ptp_struktur_organisasi ORDER BY id DESC
      `);

      // Test specific query for ptp_daerah_id = 1
      const [struktur1] = await connection.execute(`
        SELECT 
          pso.id,
          pso.ptp_daerah_id as daerah_id,
          pso.image_url,
          pso.file_name,
          pso.uploaded_at,
          pd.nama as nama_daerah,
          pd.kode as kode_daerah
        FROM ptp_struktur_organisasi pso
        JOIN ptp_daerah pd ON pso.ptp_daerah_id = pd.id
        WHERE pso.ptp_daerah_id = 1
        ORDER BY pso.uploaded_at DESC
        LIMIT 1
      `);

      // Test specific query for ptp_daerah_id = 3
      const [struktur3] = await connection.execute(`
        SELECT 
          pso.id,
          pso.ptp_daerah_id as daerah_id,
          pso.image_url,
          pso.file_name,
          pso.uploaded_at,
          pd.nama as nama_daerah,
          pd.kode as kode_daerah
        FROM ptp_struktur_organisasi pso
        JOIN ptp_daerah pd ON pso.ptp_daerah_id = pd.id
        WHERE pso.ptp_daerah_id = 3
        ORDER BY pso.uploaded_at DESC
        LIMIT 1
      `);

      await connection.end();

      return NextResponse.json({
        success: true,
        data: {
          allStruktur: allStruktur,
          strukturForId1: (struktur1 as any[])[0] || null,
          strukturForId3: (struktur3 as any[])[0] || null,
          testUrls: {
            id1: (struktur1 as any[])[0]?.image_url || null,
            id3: (struktur3 as any[])[0]?.image_url || null
          }
        }
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Test PTP struktur error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test PTP struktur data',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
