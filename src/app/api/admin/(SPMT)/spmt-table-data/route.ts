import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getRegionFromUnitKerja } from '@/lib/unit-kerja-region-mapping';

// XLSX will be dynamically imported only when needed (export=excel)

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;
  try {
    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const daerahId = searchParams.get('daerah_id');
    
    // Validasi dan parse pagination dengan default yang aman
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100));
    const offset = Math.max(0, (page - 1) * limit);
    const exportType = (searchParams.get('export') || '').toLowerCase();

    // Validasi month jika ada
    if (month && month !== 'all') {
      const monthInt = parseInt(month, 10);
      if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Bulan tidak valid (harus 1-12 atau "all")',
            details: `Received month: ${month}`
          }, 
          { status: 400 }
        );
      }
    }

    // Validasi year jika ada
    if (year && year !== 'all') {
      const yearInt = parseInt(year, 10);
      if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tahun tidak valid',
            details: `Received year: ${year}`
          }, 
          { status: 400 }
        );
      }
    }

    // Database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    let whereClause = '';
    const queryParams: number[] = [];

    // Build WHERE clause for filtering
    if (month && year && month !== 'all' && year !== 'all') {
      const monthInt = parseInt(month, 10);
      const yearInt = parseInt(year, 10);
      if (!isNaN(monthInt) && !isNaN(yearInt)) {
        whereClause = 'WHERE bulan = ? AND tahun = ?';
        queryParams.push(monthInt, yearInt);
      }
    } else if (month && month !== 'all') {
      const monthInt = parseInt(month, 10);
      if (!isNaN(monthInt)) {
        whereClause = 'WHERE bulan = ?';
        queryParams.push(monthInt);
      }
    } else if (year && year !== 'all') {
      const yearInt = parseInt(year, 10);
      if (!isNaN(yearInt)) {
        whereClause = 'WHERE tahun = ?';
        queryParams.push(yearInt);
      }
    }

    // If exporting, export ALL regions (ignore daerah filter), but respect period filters
    if (exportType === 'excel') {
      const XLSX = await import('xlsx');
      const exportParams: number[] = [...queryParams];
      const [exportRows] = await connection.execute(
        `SELECT 
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
          kategori, jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan, non_operasional,
          status_laporan_rakomdir,
          bulan, tahun
        FROM spmtdata 
        ${whereClause}
        ORDER BY nama ASC`,
        exportParams
      );

      const header = [
        'NPP','Nama','Tanggal Lahir','Jabatan','Entitas','Unit Kerja',
        'Kategori','Jenis Kelamin','Pendidikan','Organik/Non Organik',
        'Pusat Pelayanan','Non Operasional','Status Laporan Rakomdir','Bulan','Tahun'
      ];

      const safeFormatDate = (v: any): string => {
        if (!v) return '';
        const str = typeof v === 'string' ? v : '' + v;
        if (!str || str === '0000-00-00') return '';
        // If already in YYYY-MM-DD, use as-is
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
        r.status_laporan_rakomdir || '',
        r.bulan ?? '',
        r.tahun ?? ''
      ]));

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SPMT');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const labelMonth = month && month !== 'all' ? month : 'ALL';
      const labelYear = year || 'ALL';
      const filename = `SPMT_${labelYear}_${labelMonth}.xlsx`;

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

    // Handle region filtering based on unit_kerja matching
    if (daerahId) {
      // Get daerah info
      const [daerahResult] = await connection.execute(
        'SELECT nama, kode FROM daerah WHERE id = ?',
        [parseInt(daerahId, 10)]
      );
      
      if ((daerahResult as any[]).length > 0) {
        const daerahInfo = (daerahResult as any[])[0];
        
        // Simple direct filtering by unit_kerja containing region name
        let unitKerjaFilter = '';
        switch(daerahInfo.kode) {
          case 'BBLW': unitKerjaFilter = 'BELAWAN'; break;
          case 'BTJW': unitKerjaFilter = 'TANJUNG WANGI'; break;
          case 'BDMI': unitKerjaFilter = 'DUMAI'; break;
          case 'BTJI': unitKerjaFilter = 'TANJUNG INTAN'; break;
          case 'BBHG': unitKerjaFilter = 'BUMIHARJO'; break;
          case 'BMKS': unitKerjaFilter = 'MAKASSAR'; break;
          case 'BBLP': unitKerjaFilter = 'BALIKPAPAN'; break;
          case 'BJMR': unitKerjaFilter = 'JAMRUD NILAM'; break;
          case 'BTRI': unitKerjaFilter = 'TRISAKTI'; break;
          case 'BPRE': unitKerjaFilter = 'PARE-PARE'; break;
          case 'BTJE': unitKerjaFilter = 'TANJUNG EMAS'; break;
          case 'BLMB': unitKerjaFilter = 'LEMBAR'; break;
          case 'BGRS': unitKerjaFilter = 'GRESIK'; break;
          case 'BMLH': unitKerjaFilter = 'MALAHAYATI'; break;
          case 'BLHW': unitKerjaFilter = 'LHOKSEUMAWE'; break;
          case 'BNOA': unitKerjaFilter = 'BENOA'; break;
          case 'BSBG': unitKerjaFilter = 'SIBOLGA'; break;
          case 'BTBK': unitKerjaFilter = 'TANJUNG BALAI'; break;
          case 'BTPI': unitKerjaFilter = 'TANJUNG PINANG'; break;
          case 'BBMB': unitKerjaFilter = 'BIMA BADAS'; break;
          case 'KP': unitKerjaFilter = 'KANTOR PUSAT'; break;
          default: unitKerjaFilter = daerahInfo.nama.toUpperCase(); break;
        }
        
        // Get total count for pagination
        const countQuery = `
          SELECT COUNT(*) as total
          FROM spmtdata 
          ${whereClause ? whereClause + ' AND' : 'WHERE'} 
          (unit_kerja LIKE ? OR unit_kerja LIKE ? OR entitas LIKE ? OR entitas LIKE ?)
        `;
        
        const countParams: (string | number)[] = [...queryParams, `%${unitKerjaFilter}%`, `%SPMT-${unitKerjaFilter}%`, `%${unitKerjaFilter}%`, `%${unitKerjaFilter} SPMT%`];
        const [countResult] = await connection.execute(countQuery, countParams);
        const totalRecords = (countResult as any[])[0].total;
        
        // Get paginated data filtered by unit_kerja containing the region name
        const filteredQuery = `
          SELECT 
            npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
            kategori, jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan, non_operasional, status_laporan_rakomdir
          FROM spmtdata 
          ${whereClause ? whereClause + ' AND' : 'WHERE'} 
          (unit_kerja LIKE ? OR unit_kerja LIKE ? OR entitas LIKE ? OR entitas LIKE ?)
          ORDER BY nama ASC
          LIMIT ? OFFSET ?
        `;
        
        // Pastikan limit dan offset adalah integer murni
        const limitInt = Math.floor(Number(limit));
        const offsetInt = Math.floor(Number(offset));
        const filterParams: (string | number)[] = [
          ...queryParams, 
          `%${unitKerjaFilter}%`, 
          `%SPMT-${unitKerjaFilter}%`, 
          `%${unitKerjaFilter}%`, 
          `%${unitKerjaFilter} SPMT%`, 
          limitInt, 
          offsetInt
        ];
        const [filteredData] = await connection.execute(filteredQuery, filterParams);

        await connection.end();
        connection = null;

        return NextResponse.json({
          success: true,
          data: filteredData,
          pagination: {
            page,
            limit,
            total: totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            hasNext: page < Math.ceil(totalRecords / limit),
            hasPrev: page > 1
          }
        });
      }
    }

    // Get total count for pagination (non-region specific)
    const countQuery = whereClause 
      ? `SELECT COUNT(*) as total FROM spmtdata ${whereClause}`
      : `SELECT COUNT(*) as total FROM spmtdata`;
    const [countResult] = await connection.execute(countQuery, queryParams);
    const totalRecords = Number((countResult as any[])[0]?.total || 0);

    // Get paginated table data from spmtdata with filtering
    const dataQuery = whereClause
      ? `SELECT 
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
          kategori, jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan, non_operasional, status_laporan_rakomdir
        FROM spmtdata 
        ${whereClause}
        ORDER BY nama ASC
        LIMIT ? OFFSET ?`
      : `SELECT 
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
          kategori, jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan, non_operasional, status_laporan_rakomdir
        FROM spmtdata 
        ORDER BY nama ASC
        LIMIT ? OFFSET ?`;
    
    // Build parameter array dengan tipe yang benar untuk MySQL2 di Node v24
    const dataParams: number[] = [];
    
    // Tambahkan queryParams (untuk WHERE clause) jika ada whereClause
    // queryParams sudah divalidasi sebelumnya dan hanya berisi number yang valid
    if (whereClause && queryParams.length > 0) {
      // Pastikan semua parameter adalah integer
      for (const param of queryParams) {
        if (typeof param === 'number' && !isNaN(param) && Number.isFinite(param)) {
          dataParams.push(Math.floor(param));
        }
      }
    }
    
    // Pastikan limit dan offset adalah integer murni (bukan float) dan valid
    const limitInt = Math.floor(Number(limit));
    const offsetInt = Math.floor(Number(offset));
    if (isNaN(limitInt) || isNaN(offsetInt) || limitInt < 0 || offsetInt < 0) {
      throw new Error(`Invalid pagination parameters: limit=${limitInt}, offset=${offsetInt}`);
    }
    dataParams.push(limitInt, offsetInt);
    
    // Validasi jumlah parameter sesuai dengan placeholder
    const placeholderCount = (dataQuery.match(/\?/g) || []).length;
    if (dataParams.length !== placeholderCount) {
      console.error('SQL Parameter Mismatch:', {
        query: dataQuery,
        expectedPlaceholders: placeholderCount,
        actualParams: dataParams.length,
        params: dataParams,
        whereClause,
        queryParams
      });
      throw new Error(`SQL parameter count mismatch: query has ${placeholderCount} placeholders but ${dataParams.length} parameters provided`);
    }
    
    const [rows] = await connection.execute(dataQuery, dataParams);

    await connection.end();
    connection = null;

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNext: page < Math.ceil(totalRecords / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch table data', 
        details: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try { await connection.end(); } catch {}
    }
  }
}
