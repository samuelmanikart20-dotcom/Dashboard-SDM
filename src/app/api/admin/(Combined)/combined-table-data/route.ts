// src/app/api/admin/combined-table-data/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

type WhereBuild = {
  whereSql: string;
  params: number[];
};

function buildWhere(month: string | null, year: string | null): WhereBuild {
  if (!year) {
    return { whereSql: '1=0', params: [] };
  }

  const tahun = Math.floor(parseInt(String(year), 10));
  if (isNaN(tahun) || tahun < 2000 || tahun > 2100) {
    return { whereSql: '1=0', params: [] };
  }

  if (month && month !== 'all') {
    const bulan = Math.floor(parseInt(String(month), 10));
    if (isNaN(bulan) || bulan < 1 || bulan > 12) {
      return { whereSql: '1=0', params: [] };
    }

    return {
      whereSql: 'bulan = ? AND tahun = ?',
      params: [bulan, tahun],
    };
  }

  return {
    whereSql: 'tahun = ?',
    params: [tahun],
  };
}

export async function GET(req: Request) {
  let conn: mysql.Connection | null = null;

  try {
    const url = new URL(req.url);

    const month = url.searchParams.get('month');
    const year = url.searchParams.get('year');

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100));
    const offset = Math.max(0, (page - 1) * limit);

    const exportType = (url.searchParams.get('export') || '').toLowerCase();

    const { whereSql, params } = buildWhere(month, year);

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    const cols = `
      npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
      kategori, jenis_kelamin, pendidikan, organik_non_organik,
      pusat_pelayanan, non_operasional, bulan, tahun
    `;

    const unionSql = `
      SELECT ${cols}, 'SPMT' AS sumber FROM spmtdata WHERE ${whereSql}
      UNION ALL
      SELECT ${cols}, 'PTP'  AS sumber FROM ptpdata  WHERE ${whereSql}
      UNION ALL
      SELECT ${cols}, 'IKT'  AS sumber FROM iktdata  WHERE ${whereSql}
      UNION ALL
      SELECT ${cols}, 'TCU'  AS sumber FROM tcudata  WHERE ${whereSql}
    `;

    // ⚠️ params HARUS diulang 4x (untuk setiap UNION ALL)
    // Pastikan semua params adalah integer yang valid
    const cleanParams: number[] = [];
    for (const param of params) {
      if (typeof param === 'number' && !isNaN(param) && Number.isFinite(param)) {
        cleanParams.push(Math.floor(param)); // Pastikan integer
      }
    }
    
    // Ulang params 4 kali untuk setiap UNION ALL (SPMT, PTP, IKT, TCU)
    const unionParams: number[] = cleanParams.length > 0
      ? [...cleanParams, ...cleanParams, ...cleanParams, ...cleanParams]
      : [];

    /* ===================== EXPORT ===================== */
    if (exportType === 'excel') {
      const XLSX = await import('xlsx');

      const [rows] = await conn.execute(
        `${unionSql} ORDER BY sumber ASC, nama ASC`,
        unionParams
      );

      const header = [
        'NPP', 'Nama', 'Tanggal Lahir', 'Jabatan', 'Entitas', 'Unit Kerja',
        'Kategori', 'Jenis Kelamin', 'Pendidikan', 'Organik/Non Organik',
        'Pusat Pelayanan', 'Non Operasional', 'Sumber', 'Bulan', 'Tahun',
      ];

      const formatDate = (v: any) => {
        if (!v || v === '0000-00-00') return '';
        const d = new Date(v);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
      };

      const data = (rows as any[]).map(r => ([
        r.npp ?? '',
        r.nama ?? '',
        formatDate(r.tanggal_lahir),
        r.jabatan ?? '',
        r.entitas ?? '',
        r.unit_kerja ?? '',
        r.kategori ?? '',
        r.jenis_kelamin ?? '',
        r.pendidikan ?? '',
        r.organik_non_organik ?? '',
        r.pusat_pelayanan ?? '',
        r.non_operasional ?? '',
        r.sumber ?? '',
        r.bulan ?? '',
        r.tahun ?? '',
      ]));

      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Combined Data');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      await conn.end();

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Combined_${month || 'ALL'}_${year}.xlsx"`,
          'Cache-Control': 'no-store'
        },
      });
    }

    /* ===================== COUNT ===================== */
    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) x`;
    const [countRows] = await conn.execute(countSql, unionParams);
    const total = Number((countRows as any)[0]?.total || 0);

    /* ===================== DATA ===================== */
    const dataSql = `
      ${unionSql}
      ORDER BY nama ASC
      LIMIT ? OFFSET ?
    `;

    // Build dataParams dengan validasi untuk Node v24
    // unionParams sudah dibersihkan dan hanya berisi number yang valid
    const dataParams: number[] = [...unionParams];
    
    // Pastikan limit dan offset adalah integer murni dan valid
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.floor(Number(offset));
    if (isNaN(limitInt) || isNaN(offsetInt) || limitInt < 0 || offsetInt < 0) {
      throw new Error(`Invalid pagination parameters: limit=${limitInt}, offset=${offsetInt}`);
    }
    dataParams.push(limitInt, offsetInt);
    
    const [rows] = await conn.execute(dataSql, dataParams);

    await conn.end();

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('combined-table-data error:', err);
    if (conn) {
      try {
        await conn.end();
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr);
      }
    }
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
