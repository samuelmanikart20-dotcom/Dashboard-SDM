import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daerahId = searchParams.get('daerah_id');
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    let query = `
      SELECT 
        b.id,
        b.daerah_id,
        d.nama as daerah_nama,
        d.kode as daerah_kode,
        CAST(b.bopo_ratio AS DECIMAL(15,2)) as bopo_ratio,
        CAST(b.produktivitas_efisiensi AS DECIMAL(15,2)) as produktivitas_efisiensi,
        CAST(b.rasio_beban_penghasilan_usaha AS DECIMAL(15,2)) as rasio_beban_penghasilan_usaha,
        b.bulan,
        b.tahun,
        b.keterangan,
        b.created_at,
        b.updated_at
      FROM bopo_spmt b
      JOIN daerah d ON b.daerah_id = d.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (daerahId) {
      query += ' AND b.daerah_id = ?';
      params.push(daerahId);
    }
    
    if (bulan) {
      query += ' AND b.bulan = ?';
      params.push(bulan);
    }
    
    if (tahun) {
      query += ' AND b.tahun = ?';
      params.push(tahun);
    }
    
    // Order by most recent first
    query += ' ORDER BY b.tahun DESC, b.bulan DESC, b.created_at DESC';
    
    // Limit to get the most recent data for dashboard
    query += ' LIMIT 1';
    
    let [rows] = await connection.execute(query, params);

    let usedFallback = false;

    // Fallback: only when NO specific period is requested (neither month nor year provided)
    if ((rows as any[]).length === 0 && daerahId && !bulan && !tahun) {
      const fallbackQuery = `
        SELECT 
          b.id,
          b.daerah_id,
          d.nama as daerah_nama,
          d.kode as daerah_kode,
          CAST(b.bopo_ratio AS DECIMAL(15,2)) as bopo_ratio,
          CAST(b.produktivitas_efisiensi AS DECIMAL(15,2)) as produktivitas_efisiensi,
          CAST(b.rasio_beban_penghasilan_usaha AS DECIMAL(15,2)) as rasio_beban_penghasilan_usaha,
          b.bulan,
          b.tahun,
          b.keterangan,
          b.created_at,
          b.updated_at
        FROM bopo_spmt b
        JOIN daerah d ON b.daerah_id = d.id
        WHERE b.daerah_id = ?
        ORDER BY b.tahun DESC, b.bulan DESC, b.created_at DESC
        LIMIT 1
      `;
      const [fallbackRows] = await connection.execute(fallbackQuery, [daerahId]);
      if ((fallbackRows as any[]).length > 0) {
        rows = fallbackRows;
        usedFallback = true;
      }
    }
    
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: rows,
      fallback: usedFallback
    });
    
  } catch (error) {
    console.error('Error fetching BOPO dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch BOPO dashboard data' },
      { status: 500 }
    );
  }
}
