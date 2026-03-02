import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Get all unique unit_kerja values and their counts
    const [unitKerjaData] = await connection.execute(`
      SELECT 
        unit_kerja,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT entitas SEPARATOR ', ') as entitas_values
      FROM spmtdata 
      WHERE unit_kerja IS NOT NULL AND unit_kerja != ''
      GROUP BY unit_kerja
      ORDER BY count DESC
    `);

    // Get specific data that might be related to Tanjung Wangi
    const [tanjungWangiData] = await connection.execute(`
      SELECT 
        npp, nama, unit_kerja, entitas
      FROM spmtdata 
      WHERE entitas LIKE '%TANJUNG WANGI%' OR unit_kerja LIKE '%TANJUNG%' OR unit_kerja LIKE '%WANGI%'
    `);

    await connection.end();

    return NextResponse.json({
      success: true,
      data: {
        allUnitKerja: unitKerjaData,
        tanjungWangiRelated: tanjungWangiData
      }
    });

  } catch (error) {
    console.error('Error debugging unit kerja:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to debug unit kerja' },
      { status: 500 }
    );
  }
}
