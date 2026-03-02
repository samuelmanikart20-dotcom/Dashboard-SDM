import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getRegionFromUnitKerja } from '@/lib/unit-kerja-region-mapping';

export async function GET(request: NextRequest) {
  try {
    // Get month, year, and daerah_id from query parameters
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const daerahId = searchParams.get('daerah_id');

    // Build WHERE clause for filtering
    let whereClause = '';
    const queryParams: any[] = [];

    if (month && year && month !== 'all' && year !== 'all') {
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      queryParams.push(parseInt(month), parseInt(year));
    } else if (month && month !== 'all') {
      whereClause = 'WHERE bulan = ?';
      queryParams.push(parseInt(month));
    } else if (year && year !== 'all') {
      // Consolidation mode: show all months for the selected year
      whereClause = 'WHERE tahun = ?';
      queryParams.push(parseInt(year));
    }

    // Add daerah_id filter if provided
    if (daerahId) {
      // Get daerah info
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'spmt_pelindo',
      });

      const [daerahResult] = await connection.execute(
        'SELECT nama, kode FROM daerah WHERE id = ?',
        [parseInt(daerahId)]
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
        
        // Get data filtered by unit_kerja containing the region name
        const filteredQuery = `
          SELECT unit_kerja, jenis_kelamin, organik_non_organik, pusat_pelayanan, non_operasional
          FROM spmtdata 
          ${whereClause ? whereClause + ' AND' : 'WHERE'} 
          (unit_kerja LIKE ? OR unit_kerja LIKE ? OR entitas LIKE ?)
        `;
        
        const filterParams = [...queryParams, `%${unitKerjaFilter}%`, `%SPMT-${unitKerjaFilter}%`, `%${unitKerjaFilter}%`];
        const [filteredData] = await connection.execute(filteredQuery, filterParams);
        
        // Debug: Show sample data to understand column values
        if ((filteredData as any[]).length > 0) {
          (filteredData as any[]).slice(0, 3).forEach((row, index) => {
          });
        } else {
          console.log('=== NO DATA FOUND ===');
          console.log('Checking if any data exists in database...');
          
          // Check if there's any data at all
          const [totalCheck] = await connection.execute('SELECT COUNT(*) as total FROM spmtdata');
          console.log('Total records in spmtdata:', (totalCheck as any[])[0].total);
          
          // Check unit_kerja values
          const [unitCheck] = await connection.execute(`
            SELECT DISTINCT unit_kerja, COUNT(*) as count 
            FROM spmtdata 
            GROUP BY unit_kerja 
            ORDER BY count DESC 
            LIMIT 10
          `);
          console.log('Top unit_kerja values:', unitCheck);
        }
        
        // Process filtered data for statistics
        let lakiLaki = 0, perempuan = 0;
        let organik = 0, nonOrganik = 0;
        let operasional = 0, nonOperasional = 0;
        let organikOperasional = 0, organikNonOperasional = 0;
        let nonOrganikOperasional = 0, nonOrganikNonOperasional = 0;
        const unitKerjaStats: { [key: string]: number } = {};

        (filteredData as any[]).forEach(row => {
          // Count unit kerja
          if (row.unit_kerja && row.unit_kerja.trim() !== '') {
            unitKerjaStats[row.unit_kerja] = (unitKerjaStats[row.unit_kerja] || 0) + 1;
          }

          // Gender counting
          if (row.jenis_kelamin) {
            const gender = row.jenis_kelamin.toUpperCase().trim();
            if (gender === 'L' || gender === 'LAKI-LAKI' || gender === 'LAKI LAKI') {
              lakiLaki++;
            } else if (gender === 'P' || gender === 'PEREMPUAN') {
              perempuan++;
            }
          }

          // Organik/Non-Organik counting
          if (row.organik_non_organik) {
            const organikStatus = row.organik_non_organik.toUpperCase().trim();
            if (organikStatus.includes('ORGANIK') && !organikStatus.includes('NON')) {
              organik++;
            } else if (organikStatus.includes('NON ORGANIK') || organikStatus.includes('NON-ORGANIK')) {
              nonOrganik++;
            }
          }

          // Operasional/Non-Operasional counting
          let isOperasional = false;
          let isNonOperasional = false;

          // Check both pusat_pelayanan and non_operasional columns for operational status
          if (row.pusat_pelayanan) {
            const pusatPelayanan = row.pusat_pelayanan.toUpperCase().trim();
            if (pusatPelayanan.includes('OPERASIONAL') && !pusatPelayanan.includes('NON')) {
              operasional++;
              isOperasional = true;
            }
          }
          
          if (row.non_operasional) {
            const nonOp = row.non_operasional.toUpperCase().trim();
            if (nonOp.includes('NON OPERASIONAL') || nonOp.includes('NON-OPERASIONAL')) {
              nonOperasional++;
              isNonOperasional = true;
            }
          }

          // If neither column has clear operational status, check for general patterns
          if (!isOperasional && !isNonOperasional) {
            if (row.pusat_pelayanan && row.pusat_pelayanan.toUpperCase().includes('OPERASI')) {
              operasional++;
              isOperasional = true;
            } else if (row.pusat_pelayanan && row.pusat_pelayanan.toUpperCase().includes('PENGELOLAAN')) {
              nonOperasional++;
              isNonOperasional = true;
            }
          }

          // Combined counting
          const isOrganik = row.organik_non_organik && 
            row.organik_non_organik.toUpperCase().includes('ORGANIK') && 
            !row.organik_non_organik.toUpperCase().includes('NON');

          if (isOrganik && isOperasional) organikOperasional++;
          if (isOrganik && isNonOperasional) organikNonOperasional++;
          if (!isOrganik && isOperasional) nonOrganikOperasional++;
          if (!isOrganik && isNonOperasional) nonOrganikNonOperasional++;
        });

        const total = (filteredData as any[]).length;

        await connection.end();

        return NextResponse.json({
          success: true,
          data: {
            totalEmployees: total,
            region: daerahInfo,
            chartData: {
              lakiLaki,
              perempuan,
              organik,
              nonOrganik,
              operasional,
              nonOperasional,
              organikOperasional,
              organikNonOperasional,
              nonOrganikOperasional,
              nonOrganikNonOperasional,
              total,
              unitKerjaStats
            }
          }
        });
      }
    }

    // If both are 'all' or not provided, show all data (no WHERE clause)

    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Get total count from spmtdata with filtering
      const [totalResult] = await connection.execute(`
        SELECT COUNT(*) as total FROM spmtdata ${whereClause}
      `, queryParams);
      const total = (totalResult as any[])[0]?.total || 0;

      // Get gender distribution with filtering
      const [genderResult] = await connection.execute(`
        SELECT 
          jenis_kelamin,
          COUNT(*) as count
        FROM spmtdata 
        ${whereClause}
        GROUP BY jenis_kelamin
      `, queryParams);

      // Get organik/non-organik distribution with filtering
      const [organikResult] = await connection.execute(`
        SELECT 
          organik_non_organik,
          COUNT(*) as count
        FROM spmtdata 
        ${whereClause}
        GROUP BY organik_non_organik
      `, queryParams);

      // Get operasional/non-operasional distribution with filtering
      // PRIORITIZE non_operasional column - it's the explicit status from Excel
      const [operasionalResult] = await connection.execute(`
        SELECT 
          pusat_pelayanan,
          non_operasional,
          COUNT(*) as count
        FROM spmtdata 
        ${whereClause}
        GROUP BY pusat_pelayanan, non_operasional
      `, queryParams);

      // Debug: Check all pusat_pelayanan values with filtering
      const [debugResult] = await connection.execute(`
        SELECT DISTINCT pusat_pelayanan, COUNT(*) as count
        FROM spmtdata 
        ${whereClause}
        GROUP BY pusat_pelayanan
        ORDER BY count DESC
      `, queryParams);

      // Process results
      const genderData = (genderResult as any[]);
      const organikData = (organikResult as any[]);
      const operasionalData = (operasionalResult as any[]);

      let lakiLaki = 0, perempuan = 0;
      let organik = 0, nonOrganik = 0;
      let operasional = 0, nonOperasional = 0;

      // Process gender data - handle both L/P and full names
      genderData.forEach(row => {
        const gender = row.jenis_kelamin?.toLowerCase();
        if (gender === 'l' || gender === 'laki-laki' || gender === 'laki' || gender === 'pria') {
          lakiLaki += row.count;
        } else if (gender === 'p' || gender === 'perempuan' || gender === 'wanita') {
          perempuan += row.count;
        }
      });

      // Process organik data
      organikData.forEach(row => {
        const status = row.organik_non_organik?.toLowerCase();
        if (status?.includes('non') && status?.includes('organik')) {
          nonOrganik += row.count;
        } else if (status?.includes('organik')) {
          organik += row.count;
        }
      });

      // Process operasional data - PRIORITIZE non_operasional column
      operasionalData.forEach(row => {
        let status = '';
        
        // PRIORITIZE non_operasional column - it's the explicit status from Excel
        const nonOp = String(row.non_operasional || '').trim();
        const nonOpUpper = nonOp.toUpperCase();
        
        // Check non_operasional first - this is the PRIMARY source of truth
        if (nonOp && nonOp !== '') {
          // Exact matches first (case-insensitive)
          if (nonOpUpper === 'OPERASIONAL') {
            status = 'operasional';
          } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
            status = 'non-operasional';
          } 
          // Pattern matches - prioritize "NON" detection
          else if (nonOpUpper.includes('NON')) {
            status = 'non-operasional';
          } 
          // If it contains "OPERASIONAL" but NOT "NON", it's operasional
          else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
            status = 'operasional';
          }
        }
        
        // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
        // This is a fallback, not a primary source
        if (!status && row.pusat_pelayanan) {
          const pusatPelayanan = String(row.pusat_pelayanan).toLowerCase();
          if (pusatPelayanan.includes('operasi langsung') || pusatPelayanan.includes('operasi tidak langsung')) {
            status = 'operasional';
          } else if (pusatPelayanan.includes('pengelolaan') || pusatPelayanan.includes('pendukung operasi')) {
            status = 'non-operasional';
          } else if (pusatPelayanan.includes('operasional') && !pusatPelayanan.includes('non')) {
            status = 'operasional';
          } else if (pusatPelayanan.includes('non operasional') || pusatPelayanan.includes('non-operasional') || 
                     pusatPelayanan.includes('nonoperasional')) {
            status = 'non-operasional';
          } else if (pusatPelayanan.includes('operasi') && !pusatPelayanan.includes('non')) {
            status = 'operasional';
          }
        }
        
        // Default fallback
        if (!status) {
          status = 'non-operasional';
        }
        
        if (status === 'operasional') {
          operasional += row.count;
        } else {
          nonOperasional += row.count;
        }
      });

      // Get combined data for detailed breakdown with filtering
      // Include non_operasional column for proper classification
      const [combinedResult] = await connection.execute(`
        SELECT 
          organik_non_organik,
          pusat_pelayanan,
          non_operasional,
          COUNT(*) as count
        FROM spmtdata 
        ${whereClause}
        GROUP BY organik_non_organik, pusat_pelayanan, non_operasional
      `, queryParams);

      const combinedData = (combinedResult as any[]);
      let organikOperasional = 0, organikNonOperasional = 0;
      let nonOrganikOperasional = 0, nonOrganikNonOperasional = 0;

      combinedData.forEach(row => {
        
        const organikStatus = row.organik_non_organik?.toLowerCase();
        const pelayananStatus = row.pusat_pelayanan?.toLowerCase();
        const nonOp = String(row.non_operasional || '').trim();
        const nonOpUpper = nonOp.toUpperCase();
        
        // Determine if organik or non-organik
        const isOrganik = organikStatus?.includes('organik') && !organikStatus?.includes('non');
        const isNonOrganik = organikStatus?.includes('non') && organikStatus?.includes('organik');
        
        // Determine if operasional or non-operasional - PRIORITIZE non_operasional column
        let isOperasional = false;
        let isNonOperasional = false;
        
        // Check non_operasional first - PRIMARY source of truth
        if (nonOp && nonOp !== '') {
          if (nonOpUpper === 'OPERASIONAL') {
            isOperasional = true;
          } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
            isNonOperasional = true;
          } else if (nonOpUpper.includes('NON')) {
            isNonOperasional = true;
          } else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
            isOperasional = true;
          }
        }
        
        // ONLY if non_operasional is empty or unclear, check pusat_pelayanan as fallback
        if (!isOperasional && !isNonOperasional && pelayananStatus) {
          if (pelayananStatus.includes('operasi langsung') || pelayananStatus.includes('operasi tidak langsung')) {
            isOperasional = true;
          } else if (pelayananStatus.includes('pengelolaan') || pelayananStatus.includes('pendukung operasi')) {
            isNonOperasional = true;
          } else if (pelayananStatus.includes('operasional') && !pelayananStatus.includes('non')) {
            isOperasional = true;
          } else if (pelayananStatus.includes('non operasional') || pelayananStatus.includes('non-operasional') ||
                     pelayananStatus.includes('nonoperasional')) {
            isNonOperasional = true;
          } else if (pelayananStatus.includes('operasi') && !pelayananStatus.includes('non')) {
            isOperasional = true;
          }
        }
        
        // Default fallback
        if (!isOperasional && !isNonOperasional) {
          isNonOperasional = true;
        }

        if (isOrganik && isOperasional) {
          organikOperasional += row.count;
        } else if (isOrganik && isNonOperasional) {
          organikNonOperasional += row.count;
        } else if (isNonOrganik && isOperasional) {
          nonOrganikOperasional += row.count;
        } else if (isNonOrganik && isNonOperasional) {
          nonOrganikNonOperasional += row.count;
        }
      });

      await connection.end();

      return NextResponse.json({
        success: true,
        data: {
          total: total,
          chartData: {
            organik,
            nonOrganik,
            operasional,
            nonOperasional,
            lakiLaki,
            perempuan,
            organikOperasional,
            organikNonOperasional,
            nonOrganikOperasional,
            nonOrganikNonOperasional,
            total
          }
        }
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
