import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '../../../../lib/db-config';

export async function GET() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Query to get unique month/year combinations from bopo_spmt table
    const [rows] = await connection.execute(`
      SELECT 
        bulan,
        tahun,
        COUNT(*) as record_count
      FROM bopo_spmt 
      GROUP BY bulan, tahun
      ORDER BY tahun DESC, bulan DESC
    `);
    
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching BOPO available periods:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch available periods' },
      { status: 500 }
    );
  }
}
