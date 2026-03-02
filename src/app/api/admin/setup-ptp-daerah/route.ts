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
      // Create ptp_daerah table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ptp_daerah (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nama VARCHAR(255) NOT NULL,
          kode VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Insert PTP daerah data
      const ptpDaerahData = [
        { id: 1, nama: 'PTP Kantor Pusat', kode: 'KP' },
        { id: 2, nama: 'PTP Cabang Tanjung Priok', kode: 'TPK' },
        { id: 3, nama: 'PTP Cabang Banten', kode: 'BTN' },
        { id: 4, nama: 'PTP Cabang Cirebon', kode: 'CRB' },
        { id: 5, nama: 'PTP Cabang Pangka Balam', kode: 'PKB' },
        { id: 6, nama: 'PTP Cabang Tanjung Balam', kode: 'TJB' },
        { id: 7, nama: 'PTP Cabang Palembang', kode: 'PLB' },
        { id: 8, nama: 'PTP Cabang Teluk Bayur', kode: 'TBY' },
        { id: 9, nama: 'PTP Cabang Panjang', kode: 'PJG' },
        { id: 10, nama: 'PTP Cabang Bengkulu', kode: 'BKL' },
        { id: 11, nama: 'PTP Cabang Jambi', kode: 'JMB' },
        { id: 12, nama: 'PTP Cabang Pontianak', kode: 'PTK' }
      ];

      // Insert data with ON DUPLICATE KEY UPDATE
      for (const daerah of ptpDaerahData) {
        await connection.execute(`
          INSERT INTO ptp_daerah (id, nama, kode) 
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          nama = VALUES(nama), 
          kode = VALUES(kode)
        `, [daerah.id, daerah.nama, daerah.kode]);
      }

      // Create ptp_struktur_organisasi table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ptp_struktur_organisasi (
          id INT PRIMARY KEY AUTO_INCREMENT,
          ptp_daerah_id INT NOT NULL,
          image_url VARCHAR(500) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ptp_daerah_id) REFERENCES ptp_daerah(id)
        )
      `);

      // Check current data
      const [daerahCount] = await connection.execute(`
        SELECT COUNT(*) as total FROM ptp_daerah
      `);

      const [strukturCount] = await connection.execute(`
        SELECT COUNT(*) as total FROM ptp_struktur_organisasi
      `);

      await connection.end();

      return NextResponse.json({
        success: true,
        message: 'PTP daerah tables setup completed',
        data: {
          daerahRecords: (daerahCount as any)[0].total,
          strukturRecords: (strukturCount as any)[0].total
        }
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Setup PTP daerah error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to setup PTP daerah tables',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
