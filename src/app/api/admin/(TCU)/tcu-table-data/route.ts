export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
};

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const unitKerja = searchParams.get('unit_kerja');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100));
    const exportType = (searchParams.get('export') || '').toLowerCase();

    if (!bulan || !tahun) {
      return NextResponse.json({ message: 'Bulan dan tahun harus diisi' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Build WHERE clause
    let whereClause = '';
    const params: (string | number)[] = [];

    if (bulan === 'all') {
      const tahunInt = parseInt(tahun, 10);
      if (!isNaN(tahunInt)) {
        whereClause = 'WHERE tahun = ?';
        params.push(tahunInt);
      }
    } else {
      const bulanInt = parseInt(bulan, 10);
      const tahunInt = parseInt(tahun, 10);
      
      // Validate bulan is between 1-12
      if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
        return NextResponse.json({ message: 'Bulan tidak valid (harus 1-12 atau "all")' }, { status: 400 });
      }
      
      // Validate tahun is reasonable
      if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
        return NextResponse.json({ message: 'Tahun tidak valid' }, { status: 400 });
      }
      
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
    }

    // When exporting, ignore unit_kerja filter to export all units
    if (exportType !== 'excel' && unitKerja && unitKerja !== 'all') {
      if (unitKerja === 'TCU-KP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%');
      } else if (unitKerja === 'TCU-SMP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%MEKAR PUTIH%', '%Mekar Putih%');
      } else {
        whereClause += ' AND unit_kerja LIKE ?';
        params.push(`%${unitKerja}%`);
      }
    }

    // Handle Excel export (no pagination)
    if (exportType === 'excel') {
      const XLSX = await import('xlsx');

      const [exportRows] = await connection.execute(
        `SELECT 
          npp,
          nama,
          tanggal_lahir,
          jabatan,
          entitas,
          unit_kerja,
          kategori,
          jenis_kelamin,
          pendidikan,
          organik_non_organik,
          pusat_pelayanan,
          non_operasional,
          status_laporan,
          bulan,
          tahun
         FROM tcudata ${whereClause}
         ORDER BY nama ASC`,
        params
      );

      const header = [
        'NPP','Nama','Tanggal Lahir','Jabatan','Entitas','Unit Kerja',
        'Kategori','Jenis Kelamin','Pendidikan','Organik/Non Organik',
        'Pusat Pelayanan','Non Operasional','Status Laporan','Bulan','Tahun'
      ];

      const safeFormatDate = (v: any): string => {
        if (!v) return '';
        const str = typeof v === 'string' ? v : '' + v;
        if (!str || str === '0000-00-00') return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
      };

      const rows = (exportRows as any[]).map(r => ([
        r.npp || '',
        r.nama || '',
        safeFormatDate(r.tanggal_lahir),
        r.jabatan || '',
        r.entitas || '',
        r.unit_kerja || '',
        r.kategori || '',
        r.jenis_kelamin || '',
        r.pendidikan || '',
        r.organik_non_organik || '',
        r.pusat_pelayanan || '',
        r.non_operasional || '',
        r.status_laporan || '',
        r.bulan ?? '',
        r.tahun ?? ''
      ]));

      const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'TCU');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const labelMonth = bulan && bulan !== 'all' ? bulan : 'ALL';
      const labelYear = tahun || 'ALL';
      const filename = `TCU_${labelYear}_${labelMonth}.xlsx`;

      await connection.end();
      connection = null;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    // Get total count for pagination
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM tcudata ${whereClause}`,
      params
    );
    const total = (countResult as any)[0].total;

    // Calculate pagination
    const offset = Math.max(0, (page - 1) * limit);
    const totalPages = Math.ceil(total / limit);

    // Get paginated data dengan validasi parameter untuk Node v24
    const dataParams: (string | number)[] = [];
    
    // Filter params untuk menghindari undefined/null
    for (const param of params) {
      if (param !== undefined && param !== null) {
        if (typeof param === 'number' && !isNaN(param)) {
          dataParams.push(param);
        } else if (typeof param === 'string') {
          dataParams.push(param);
        }
      }
    }
    
    // Pastikan limit dan offset adalah integer murni dan valid
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.floor(Number(offset));
    if (isNaN(limitInt) || isNaN(offsetInt) || limitInt < 0 || offsetInt < 0) {
      throw new Error(`Invalid pagination parameters: limit=${limitInt}, offset=${offsetInt}`);
    }
    dataParams.push(limitInt, offsetInt);
    
    const [rows] = await connection.execute(
      `SELECT 
        npp,
        nama,
        tanggal_lahir,
        jabatan,
        entitas,
        unit_kerja,
        kategori,
        jenis_kelamin,
        pendidikan,
        organik_non_organik,
        pusat_pelayanan,
        non_operasional,
        status_laporan,
        bulan,
        tahun
       FROM tcudata ${whereClause}
       ORDER BY nama ASC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    // Format the data
    const tableData = (rows as any[]).map(row => ({
      npp: row.npp,
      nama: row.nama,
      tanggal_lahir: row.tanggal_lahir ? new Date(row.tanggal_lahir).toISOString().split('T')[0] : '',
      jabatan: row.jabatan || '',
      entitas: row.entitas || '',
      unit_kerja: row.unit_kerja || '',
      kategori: row.kategori || '',
      jenis_kelamin: row.jenis_kelamin || '',
      pendidikan: row.pendidikan || '',
      organik_non_organik: row.organik_non_organik || '',
      pusat_pelayanan: row.pusat_pelayanan || '',
      non_operasional: row.non_operasional || '',
      status_laporan: row.status_laporan || '',
      bulan: row.bulan,
      tahun: row.tahun
    }));

    return NextResponse.json({
      tableData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching TCU table data:', error);
    return NextResponse.json(
      { message: 'Error fetching table data' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try { await connection.end(); } catch {}
    }
  }
}
