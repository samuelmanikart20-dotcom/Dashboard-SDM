import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

// DELETE - Delete PTP data by bulan and tahun
export async function DELETE(request: NextRequest) {
  let connection;
  
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    
    if (!bulan || !tahun) {
      return NextResponse.json(
        { success: false, error: 'Bulan dan tahun wajib diisi' },
        { status: 400 }
      );
    }
    
    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      return NextResponse.json(
        { success: false, error: 'Bulan harus antara 1-12' },
        { status: 400 }
      );
    }
    
    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      return NextResponse.json(
        { success: false, error: 'Tahun tidak valid' },
        { status: 400 }
      );
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    // Check if data exists
    const [existingRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM ptpdata WHERE bulan = ? AND tahun = ?',
      [bulanInt, tahunInt]
    );
    
    const count = (existingRecords as any[])[0]?.count || 0;
    
    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'Data tidak ditemukan untuk bulan dan tahun yang dipilih' },
        { status: 404 }
      );
    }
    
    // Delete data
    const [result] = await connection.execute(
      'DELETE FROM ptpdata WHERE bulan = ? AND tahun = ?',
      [bulanInt, tahunInt]
    );
    
    const affectedRows = (result as any).affectedRows || 0;
    
    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${affectedRows} data PTP untuk bulan ${bulanInt} tahun ${tahunInt}`,
      deletedCount: affectedRows
    });
    
  } catch (error) {
    console.error('Error deleting PTP data:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus data PTP' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}


















