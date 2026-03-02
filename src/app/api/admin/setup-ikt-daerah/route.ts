import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(_request: NextRequest) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Create ikt_daerah table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ikt_daerah (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nama VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Insert IKT 8 cabang data dengan ID eksplisit untuk konsistensi
      // Urutan: 1=BPP, 2=BJM, 3=BLW, 4=JKT, 5=KP, 6=MKS, 7=PTK, 8=TPK
      const iktDaerahData = [
        { id: 1, nama: 'BALIKPAPAN', kode: 'IKT-BPP' },
        { id: 2, nama: 'BANJARMASIN', kode: 'IKT-BJM' },
        { id: 3, nama: 'BELAWAN', kode: 'IKT-BLW' },
        { id: 4, nama: 'Branch Jakarta', kode: 'IKT-JKT' },
        { id: 5, nama: 'KANTOR PUSAT', kode: 'IKT-KP' },
        { id: 6, nama: 'MAKASSAR', kode: 'IKT-MKS' },
        { id: 7, nama: 'PONTIANAK', kode: 'IKT-PTK' },
        { id: 8, nama: 'TANJUNG PRIOK', kode: 'IKT-TPK' }
      ];

      // Insert data with ON DUPLICATE KEY UPDATE
      for (const daerah of iktDaerahData) {
        await connection.execute(`
          INSERT INTO ikt_daerah (id, nama, kode) 
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          nama = VALUES(nama), 
          kode = VALUES(kode)
        `, [daerah.id, daerah.nama, daerah.kode]);
      }

      // Check current data
      const [daerahCount] = await connection.execute(`
        SELECT COUNT(*) as total FROM ikt_daerah
      `);

      const [daerahList] = await connection.execute(`
        SELECT id, nama, kode FROM ikt_daerah ORDER BY id
      `);

      await connection.end();

      return NextResponse.json({
        success: true,
        message: 'IKT daerah table setup completed',
        data: {
          daerahRecords: (daerahCount as any)[0].total,
          daerahList: daerahList
        }
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Setup IKT daerah error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to setup IKT daerah table',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

