import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '../../../../../lib/db-config';

export async function GET(_request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(dbConfig);

    // Check if ikt_daerah table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'ikt_daerah'");
    const hasIktDaerahTable = Array.isArray(tables) && tables.length > 0;

    let rows: any[] = [];

    if (hasIktDaerahTable) {
      // If ikt_daerah table exists, use it
      const [iktDaerahRows] = await connection.execute(
        'SELECT id, nama, kode FROM ikt_daerah ORDER BY id ASC'
      );
      rows = iktDaerahRows as any[];
    } else {
      // If table doesn't exist, return hardcoded list (fallback)
      rows = [
        { id: 1, nama: 'BALIKPAPAN', kode: 'IKT-BPP' },
        { id: 2, nama: 'BANJARMASIN', kode: 'IKT-BJM' },
        { id: 3, nama: 'BELAWAN', kode: 'IKT-BLW' },
        { id: 4, nama: 'Branch Jakarta', kode: 'IKT-JKT' },
        { id: 5, nama: 'KANTOR PUSAT', kode: 'IKT-KP' },
        { id: 6, nama: 'MAKASSAR', kode: 'IKT-MKS' },
        { id: 7, nama: 'PONTIANAK', kode: 'IKT-PTK' },
        { id: 8, nama: 'TANJUNG PRIOK', kode: 'IKT-TPK' },
      ];
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Error fetching IKT daerah:', error);
    if (connection) {
      await connection.end();
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch IKT regions',
        data: []
      },
      { status: 500 }
    );
  }
}



















