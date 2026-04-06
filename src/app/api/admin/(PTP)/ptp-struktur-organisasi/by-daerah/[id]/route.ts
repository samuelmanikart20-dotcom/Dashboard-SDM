import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id: daerahId } = await params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
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
      WHERE pso.ptp_daerah_id = ?
      ORDER BY pso.uploaded_at DESC
      LIMIT 1
    `, [daerahId]);
    
    const strukturData = rows as any[];
    
    if (strukturData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No organizational structure found for this PTP region'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: strukturData[0]
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch PTP organizational structure' 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
