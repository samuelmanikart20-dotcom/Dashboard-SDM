import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
  port: parseInt(process.env.DB_PORT || '3306'),
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get file info before deleting
    const [rows] = await connection.execute(
      'SELECT image_url FROM ptp_struktur_organisasi WHERE id = ?',
      [id]
    ) as any;
    
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'PTP organizational structure not found' },
        { status: 404 }
      );
    }
    
    const imageUrl = rows[0].image_url;
    
    // Delete from database
    await connection.execute(
      'DELETE FROM ptp_struktur_organisasi WHERE id = ?',
      [id]
    );
    
    // Delete file from filesystem
    try {
      const filePath = path.join(process.cwd(), 'public', imageUrl);
      await unlink(filePath);
    } catch (fileError) {
      console.warn('Could not delete file:', fileError);
      // Continue even if file deletion fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'PTP organizational structure deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete PTP organizational structure' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
