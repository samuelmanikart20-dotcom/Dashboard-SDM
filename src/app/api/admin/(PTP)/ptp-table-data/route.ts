import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const unitKerja = searchParams.get('unit_kerja');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100));
    const offset = Math.max(0, (page - 1) * limit);
    const exportType = (searchParams.get('export') || '').toLowerCase();

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo_revisi',
      port: Number(process.env.DB_PORT) || 3307
    });

    try {
      let whereClause = 'WHERE 1=1';
      const params: (string | number)[] = [];

      // Add period filtering dengan validasi NaN
      if (month && month !== 'all' && year) {
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        if (!isNaN(monthInt) && !isNaN(yearInt)) {
          whereClause += ' AND bulan = ? AND tahun = ?';
          params.push(monthInt, yearInt);
        }
      } else if (year) {
        const yearInt = parseInt(year, 10);
        if (!isNaN(yearInt)) {
          whereClause += ' AND tahun = ?';
          params.push(yearInt);
        }
      }

      // Add unit kerja filtering - SKIP when exporting (export=excel => all units)
      if (exportType !== 'excel' && unitKerja && unitKerja !== 'all') {
        // Get ptp_daerah info for the selected unit
        const [daerahResult] = await connection.execute(
          'SELECT id, nama, kode FROM ptp_daerah WHERE id = ?',
          [parseInt(unitKerja, 10)]
        );
        
        if ((daerahResult as any[]).length > 0) {
          const daerahInfo = (daerahResult as any[])[0];
          
          // PTP Unit Kerja mapping based on kode - use same flexible matching as ptp-dashboard-stats
          let unitKerjaFilter = '';
          switch(daerahInfo.kode) {
            case 'KP': 
              unitKerjaFilter = 'Kantor Pusat'; 
              break;
            case 'TPK': 
              unitKerjaFilter = 'Tanjung Priok'; 
              break;
            case 'BTN': 
              unitKerjaFilter = 'Banten'; 
              break;
            case 'CRB': 
              unitKerjaFilter = 'Cirebon'; 
              break;
            case 'PKB': 
              unitKerjaFilter = 'Pangka Balam'; 
              break;
            case 'TJB': 
              unitKerjaFilter = 'Tanjung Balam'; 
              break;
            case 'PLB': 
              unitKerjaFilter = 'Palembang'; 
              break;
            case 'TBY': 
              unitKerjaFilter = 'Teluk Bayur'; 
              break;
            case 'PJG': 
              unitKerjaFilter = 'Panjang'; 
              break;
            case 'BKL': 
              unitKerjaFilter = 'Bengkulu'; 
              break;
            case 'JMB': 
              unitKerjaFilter = 'Jambi'; 
              break;
            case 'PTK': 
              unitKerjaFilter = 'Pontianak'; 
              break;
            default: 
              unitKerjaFilter = daerahInfo.nama.replace('PTP ', '').trim(); 
              break;
          }
          
          // Use multiple LIKE conditions to catch different formats (same as ptp-dashboard-stats)
          // Also handle case variations (KANTOR PUSAT vs Kantor Pusat)
          whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
          const likeParam1 = `%${unitKerjaFilter}%`;
          const likeParam2 = `%${unitKerjaFilter.toUpperCase()}%`; // Uppercase version
          const likeParam3 = `%PTP%${unitKerjaFilter}%`;
          const likeParam4 = `%PTP%${unitKerjaFilter.toUpperCase()}%`; // Uppercase with PTP
          const likeParam5 = `%PTP-%${unitKerjaFilter}%`;
          const likeParam6 = `%PTP-%${unitKerjaFilter.toUpperCase()}%`; // Uppercase with PTP-
          params.push(likeParam1, likeParam2, likeParam3, likeParam4, likeParam5, likeParam6);
          
          // Debug logging
          console.log('PTP Table Data - Filtering by daerah:', {
            daerahId: daerahInfo.id,
            kode: daerahInfo.kode,
            nama: daerahInfo.nama,
            unitKerjaFilter,
            likeParams: [likeParam1, likeParam2, likeParam3, likeParam4, likeParam5, likeParam6]
          });
        }
      }

      // If export requested, return an Excel file of the filtered dataset (no pagination)
      if (exportType === 'excel') {
        // Lazy-load XLSX to avoid requiring the dependency for normal JSON requests
        const XLSX = await import('xlsx');
        const [exportRows] = await connection.execute(
          `SELECT 
            npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
            kategori, jenis_kelamin, pendidikan, organik_non_organik,
            pusat_pelayanan, non_operasional, status_laporan,
            bulan, tahun
           FROM ptpdata ${whereClause}
           ORDER BY nama ASC`,
          params
        );

        // Build worksheet data with header row
        const header = [
          'NPP','Nama','Tanggal Lahir','Jabatan','Entitas','Unit Kerja',
          'Kategori','Jenis Kelamin','Pendidikan','Organik/Non Organik',
          'Pusat Pelayanan','Non Operasional','Status Laporan','Bulan','Tahun'
        ];
        const rows = (exportRows as any[]).map(r => ([
          r.npp || '',
          r.nama || '',
          r.tanggal_lahir ? new Date(r.tanggal_lahir).toISOString().split('T')[0] : '',
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
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PTP');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

        const labelMonth = month && month !== 'all' ? month : 'ALL';
        const labelYear = year || 'ALL';
        const filename = `PTP_${labelYear}_${labelMonth}.xlsx`;

        await connection.end();
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store'
          }
        });
      }

      // Get total count for pagination
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as total FROM ptpdata ${whereClause}
      `, params);
      const total = (countResult as any)[0].total;
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
      
      const [dataResult] = await connection.execute(`
        SELECT 
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
          kategori, jenis_kelamin, pendidikan, organik_non_organik,
          pusat_pelayanan, non_operasional, status_laporan,
          bulan, tahun
        FROM ptpdata ${whereClause}
        ORDER BY nama ASC
        LIMIT ? OFFSET ?
      `, dataParams);
      
      // Debug: Check pendidikan data in results
      const pendidikanCount = (dataResult as any[]).filter(row => row.pendidikan && row.pendidikan.trim() !== '').length;
      if (dataResult && (dataResult as any[]).length > 0) {
        console.log('PTP Table Data - Results:', {
          totalRows: (dataResult as any[]).length,
          rowsWithPendidikan: pendidikanCount,
          samplePendidikan: (dataResult as any[]).slice(0, 5).map(r => ({ npp: r.npp, pendidikan: r.pendidikan, unit_kerja: r.unit_kerja }))
        });
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        data: dataResult,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch PTP table data',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
