'use server';

import mysql, { ResultSetHeader } from 'mysql2/promise';
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
  try {
    const { searchParams } = new URL(req.url);
    const daerahId = searchParams.get('ptp_daerah_id');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (!daerahId || !year) {
      return NextResponse.json({ message: 'ptp_daerah_id and year are required' }, { status: 400 });
    }

    const conn = await getConnection();
    try {
      const bulanVal = month && month !== 'all' ? parseInt(month, 10) : null;
      
      if (!bulanVal) {
        // Jika bulan adalah "all" atau null, cari data dengan bulan IS NULL
        const query = `SELECT id, ptp_daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
                       FROM ptp_kompetensi 
                       WHERE ptp_daerah_id = ? AND tahun = ? AND bulan IS NULL
                       ORDER BY FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`;
        const [rows] = await conn.execute(query, [daerahId, year]);
        return NextResponse.json({ data: rows });
      }

      // Cari data untuk bulan yang diminta
      const query = `SELECT id, ptp_daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
                   FROM ptp_kompetensi 
                   WHERE ptp_daerah_id = ? AND tahun = ? AND bulan = ?
                   ORDER BY FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`;
      const [currentRows] = await conn.execute(query, [daerahId, year, bulanVal]);
      interface KompetensiRow {
        id: number | null;
        ptp_daerah_id: string;
        bulan: number | null;
        tahun: number;
        jenis: string;
        isi: string;
        created_at?: Date;
        updated_at?: Date;
        inherited_from_month?: number;
        is_inherited?: boolean;
      }

      const currentData = Array.isArray(currentRows) ? (currentRows as KompetensiRow[]) : [];

      // Cari data dari bulan sebelumnya untuk jenis yang belum ada di bulan ini
      const [prevMonthRows] = await conn.execute(
        `SELECT id, ptp_daerah_id, bulan, tahun, jenis, isi, created_at, updated_at
         FROM ptp_kompetensi 
         WHERE ptp_daerah_id = ? AND tahun = ? AND bulan IS NOT NULL AND bulan < ?
         ORDER BY bulan DESC, FIELD(jenis,'KOMPETENSI','DIKLAT','DAMPAK'), id ASC`,
        [daerahId, year, bulanVal]
      );

      const prevData = Array.isArray(prevMonthRows) ? (prevMonthRows as KompetensiRow[]) : [];
      
      // Group data bulan sebelumnya by jenis dan ambil yang terbaru untuk setiap jenis
      const prevDataByJenis = new Map<string, KompetensiRow>();
      prevData.forEach((row: KompetensiRow) => {
        if (!prevDataByJenis.has(row.jenis)) {
          prevDataByJenis.set(row.jenis, row);
        }
      });

      // Gabungkan data bulan ini dengan data bulan sebelumnya untuk jenis yang belum ada
      const result: KompetensiRow[] = [];
      const jenisList = ['KOMPETENSI', 'DIKLAT', 'DAMPAK'];
      let inheritedFromMonth: number | null = null;

      jenisList.forEach((jenis) => {
        // Cari di data bulan ini
        const currentItem = currentData.find((r: KompetensiRow) => r.jenis === jenis);
        
        if (currentItem) {
          // Jika ada di bulan ini, gunakan data bulan ini
          result.push(currentItem);
        } else {
          // Jika tidak ada di bulan ini, cari di bulan sebelumnya
          const prevItem = prevDataByJenis.get(jenis);
          if (prevItem && prevItem.bulan !== null) {
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
          data: result,
          inherited: true,
          inherited_from_month: inheritedFromMonth
        });
      }

      return NextResponse.json({ data: result });
    } finally {
      await conn.end();
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to fetch', error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ptp_daerah_id, month, year, jenis, isi } = body || {};
    if (!ptp_daerah_id || !year || !jenis || !isi) {
      return NextResponse.json({ message: 'ptp_daerah_id, year, jenis, isi are required' }, { status: 400 });
    }

    const bulanVal = month && month !== 'all' ? parseInt(month, 10) : null;

    const conn = await getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO ptp_kompetensi (ptp_daerah_id, bulan, tahun, jenis, isi) VALUES (?, ?, ?, ?, ?)`,
        [ptp_daerah_id, bulanVal, year, jenis, isi]
      ) as [ResultSetHeader, mysql.FieldPacket[]];
      return NextResponse.json({ data: { id: result.insertId } }, { status: 201 });
    } finally {
      await conn.end();
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to create', error: errorMessage }, { status: 500 });
  }
}
