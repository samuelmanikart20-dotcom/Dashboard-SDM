'use server';

import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

async function getConnection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spmt_pelindo',
  });
  return connection;
}

export async function GET(req: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    const { searchParams } = new URL(req.url);
    const daerahId = searchParams.get('daerah_id');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (!daerahId || !year) {
      return NextResponse.json({ 
        success: false,
        message: 'daerah_id and year are required' 
      }, { status: 400 });
    }

    conn = await getConnection();
    
    // Ensure table exists
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS spmt_kompetensi (
          id INT AUTO_INCREMENT PRIMARY KEY,
          daerah_id INT NOT NULL,
          bulan INT NULL,
          tahun INT NOT NULL,
          jenis ENUM('KOMPETENSI', 'DIKLAT', 'DAMPAK') NOT NULL,
          isi TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_daerah_bulan_tahun_jenis (daerah_id, bulan, tahun, jenis),
          KEY idx_daerah (daerah_id),
          KEY idx_periode (tahun, bulan),
          CONSTRAINT fk_kompetensi_daerah FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (createError: any) {
      // Ignore error if table already exists or foreign key constraint issue
      console.log('Table creation skipped:', createError?.message);
    }
    
    const bulanVal = month && month !== 'all' ? parseInt(month, 10) : null;
    
    if (!bulanVal) {
      // Jika bulan adalah "all" atau null, cari data dengan bulan IS NULL
      const query = `SELECT id, daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
                     FROM spmt_kompetensi 
                     WHERE daerah_id = ? AND tahun = ? AND bulan IS NULL
                     ORDER BY FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`;
      const [rows] = await conn.execute(query, [daerahId, year]);
      return NextResponse.json({ success: true, data: rows });
    }

    // Cari data untuk bulan yang diminta
    const query = `SELECT id, daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
                 FROM spmt_kompetensi 
                 WHERE daerah_id = ? AND tahun = ? AND bulan = ?
                 ORDER BY FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`;
    const [currentRows] = await conn.execute(query, [daerahId, year, bulanVal]);
    const currentData = Array.isArray(currentRows) ? (currentRows as any[]) : [];

    // Cari data dari bulan sebelumnya untuk jenis yang belum ada di bulan ini
    const [prevMonthRows] = await conn.execute(
      `SELECT id, daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
       FROM spmt_kompetensi 
       WHERE daerah_id = ? AND tahun = ? AND bulan IS NOT NULL AND bulan < ?
       ORDER BY bulan DESC, FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`,
      [daerahId, year, bulanVal]
    );

    const prevData = Array.isArray(prevMonthRows) ? (prevMonthRows as any[]) : [];
    
    // Group data bulan sebelumnya by jenis dan ambil yang terbaru untuk setiap jenis
    const prevDataByJenis = new Map<string, any>();
    prevData.forEach((row: any) => {
      if (!prevDataByJenis.has(row.jenis)) {
        prevDataByJenis.set(row.jenis, row);
      }
    });

    // Gabungkan data bulan ini dengan data bulan sebelumnya untuk jenis yang belum ada
    const result: any[] = [];
    const jenisList = ['KOMPETENSI', 'DIKLAT', 'DAMPAK'];
    let inheritedFromMonth: number | null = null;

    jenisList.forEach((jenis) => {
      // Cari di data bulan ini
      const currentItem = currentData.find((r: any) => r.jenis === jenis);
      
      if (currentItem) {
        // Jika ada di bulan ini, gunakan data bulan ini
        result.push(currentItem);
      } else {
        // Jika tidak ada di bulan ini, cari di bulan sebelumnya
        const prevItem = prevDataByJenis.get(jenis);
        if (prevItem) {
          if (!inheritedFromMonth || prevItem.bulan > inheritedFromMonth) {
            inheritedFromMonth = prevItem.bulan;
          }
          result.push({
            ...prevItem,
            id: null, // Reset ID agar saat save membuat record baru
            inherited_from_month: prevItem.bulan,
            is_inherited: true
          });
        }
      }
    });

    // Return hasil gabungan
    if (inheritedFromMonth) {
      return NextResponse.json({ 
        success: true,
        data: result,
        inherited: true,
        inherited_from_month: inheritedFromMonth
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (e: any) {
    console.error('GET /api/admin/spmt-kompetensi error:', e);
    return NextResponse.json({ 
      success: false,
      message: 'Failed to fetch kompetensi data', 
      error: e?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      if (conn) await conn.end();
    } catch (closeError) {
      console.error('Error closing connection:', closeError);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { daerah_id, month, year, jenis, isi } = body || {};
    if (!daerah_id || !year || !jenis || !isi) {
      return NextResponse.json({ message: 'daerah_id, year, jenis, isi are required' }, { status: 400 });
    }

    const bulanVal = month && month !== 'all' ? parseInt(month, 10) : null;

    const conn = await getConnection();
    try {
      const [result]: any = await conn.execute(
        `INSERT INTO spmt_kompetensi (daerah_id, bulan, tahun, jenis, isi) VALUES (?, ?, ?, ?, ?)`,
        [daerah_id, bulanVal, year, jenis, isi]
      );
      return NextResponse.json({ data: { id: result.insertId } }, { status: 201 });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return NextResponse.json({ message: 'Failed to create', error: e?.message }, { status: 500 });
  }
}
