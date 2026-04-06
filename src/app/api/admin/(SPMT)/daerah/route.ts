import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307
};

export async function GET(_request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const query = `
      SELECT 
        id,
        nama,
        kode
      FROM daerah
      ORDER BY nama ASC
    `;
    
    const [rows] = await connection.execute(query);
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching daerah:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch daerah data' },
      { status: 500 }
    );
  }
}
