import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(_request: NextRequest) {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Cek apakah ada tabel tcu_daerah
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'tcu_daerah'"
    );
    const hasTcuDaerahTable = Array.isArray(tables) && tables.length > 0;
    
    let rows: any[] = [];
    
    if (hasTcuDaerahTable) {
      // Jika ada tabel tcu_daerah, gunakan itu
      const [tcuDaerahRows] = await connection.execute(
        'SELECT id, nama, kode FROM tcu_daerah ORDER BY nama ASC'
      );
      rows = tcuDaerahRows as any[];
    } else {
      // Jika tidak ada tabel tcu_daerah, ambil dari data aktual tcudata
      // Ambil semua unit_kerja unik dari tcudata
      const [distinctUnits] = await connection.execute(
        `SELECT DISTINCT unit_kerja 
         FROM tcudata 
         WHERE unit_kerja IS NOT NULL AND unit_kerja != ''
         ORDER BY unit_kerja ASC`
      );
      
      const unitKerjaList = (distinctUnits as any[]).map((row, index) => {
        // Normalize unit_kerja untuk menentukan kode
        let kode = '';
        let nama = row.unit_kerja;
        
        if (row.unit_kerja.includes('KANTOR PUSAT') || row.unit_kerja.includes('Kantor Pusat')) {
          kode = 'KP';
          nama = 'Kantor Pusat';
        } else if (row.unit_kerja.includes('MEKAR PUTIH') || row.unit_kerja.includes('Mekar Putih')) {
          kode = 'SMP';
          nama = 'Mekar Putih';
        } else {
          // Ambil nama dari unit_kerja
          kode = `TCU-${index + 1}`;
          nama = row.unit_kerja;
        }
        
        return {
          id: index + 1,
          nama: nama,
          kode: kode
        };
      });
      
      // Remove duplicates based on nama
      const uniqueUnits = Array.from(
        new Map(unitKerjaList.map(item => [item.nama, item])).values()
      );
      
      rows = uniqueUnits;
    }
    
    await connection.end();
    return NextResponse.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch TCU regions' 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

