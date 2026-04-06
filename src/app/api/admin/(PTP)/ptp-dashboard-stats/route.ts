import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(request: NextRequest) {
  try {
    // Get month, year, and unit_kerja from query parameters
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const unitKerja = searchParams.get('unit_kerja');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo_revisi',
      port: Number(process.env.DB_PORT) || 3307
    });

    try {
      // DEBUG: Lihat semua data di database tanpa filter
      const [allData] = await connection.execute(`
        SELECT unit_kerja, COUNT(*) as count
        FROM ptpdata
        GROUP BY unit_kerja
        ORDER BY count DESC
      `);

      // DEBUG: Lihat data untuk unit_kerja yang mengandung "Kantor" atau "Pusat"
      const [kantorPusatData] = await connection.execute(`
        SELECT unit_kerja, COUNT(*) as count
        FROM ptpdata
        WHERE unit_kerja LIKE '%Kantor%' OR unit_kerja LIKE '%Pusat%' OR unit_kerja LIKE '%PTP%'
        GROUP BY unit_kerja
      `);

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Add period filtering
      if (month && month !== 'all' && year) {
        whereClause += ' AND bulan = ? AND tahun = ?';
        params.push(parseInt(month), parseInt(year));
      } else if (year) {
        whereClause += ' AND tahun = ?';
        params.push(parseInt(year));
      }

      // Add unit kerja filtering - use ptp_daerah mapping like SPMT
      if (unitKerja && unitKerja !== 'all') {
        // Get ptp_daerah info for the selected unit
        const [daerahResult] = await connection.execute(
          'SELECT id, nama, kode FROM ptp_daerah WHERE id = ?',
          [parseInt(unitKerja)]
        );
        
        if ((daerahResult as any[]).length > 0) {
          const daerahInfo = (daerahResult as any[])[0];
  
          
          // PTP Unit Kerja mapping based on kode - more flexible matching
          let unitKerjaFilter = '';
          switch(daerahInfo.kode) {
            case 'KP': 
              unitKerjaFilter = 'Kantor Pusat'; 
              break;  // More general matching for Kantor Pusat
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
          
          
          // Use multiple LIKE conditions to catch different formats
          // Also handle case variations (KANTOR PUSAT vs Kantor Pusat)
          whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
          const likeParam1 = `%${unitKerjaFilter}%`;
          const likeParam2 = `%${unitKerjaFilter.toUpperCase()}%`; // Uppercase version
          const likeParam3 = `%PTP%${unitKerjaFilter}%`;
          const likeParam4 = `%PTP%${unitKerjaFilter.toUpperCase()}%`; // Uppercase with PTP
          const likeParam5 = `%PTP-%${unitKerjaFilter}%`;
          const likeParam6 = `%PTP-%${unitKerjaFilter.toUpperCase()}%`; // Uppercase with PTP-
          params.push(likeParam1, likeParam2, likeParam3, likeParam4, likeParam5, likeParam6);
          
        }
      }

      // Get total count - sudah benar
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM ptpdata ${whereClause}
      `, params);
      const totalEmployees = (countResult as any[])[0]?.total || 0;

      // DEBUG: Lihat sample data untuk analisis
      const [sampleResult] = await connection.execute(`
        SELECT 
          npp, nama, unit_kerja, 
          jenis_kelamin, 
          organik_non_organik, 
          pusat_pelayanan, 
          non_operasional,
          bulan, tahun
        FROM ptpdata ${whereClause}
        LIMIT 5
      `, params);

      // DEBUG: Lihat distinct values untuk setiap kolom distribusi
      const [distinctGender] = await connection.execute(`
        SELECT DISTINCT jenis_kelamin, COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY jenis_kelamin
      `, params);

      const [distinctOrganik] = await connection.execute(`
        SELECT DISTINCT organik_non_organik, COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY organik_non_organik
      `, params);

      const [distinctPusat] = await connection.execute(`
        SELECT DISTINCT pusat_pelayanan, COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY pusat_pelayanan
      `, params);

      const [distinctNonOp] = await connection.execute(`
        SELECT DISTINCT non_operasional, COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY non_operasional
      `, params);

      // Get gender distribution
      const [genderResult] = await connection.execute(`
        SELECT 
          jenis_kelamin,
          COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY jenis_kelamin
      `, params);

      // Get organik/non-organik distribution - DIRECTLY from organik_non_organik column
      const [organikResult] = await connection.execute(`
        SELECT 
          organik_non_organik,
          COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY organik_non_organik
      `, params);

      // Get operasional/non-operasional distribution - check both columns but avoid double counting
      const [operasionalResult] = await connection.execute(`
        SELECT 
          pusat_pelayanan,
          non_operasional,
          COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY pusat_pelayanan, non_operasional
      `, params);

      // Get combined data for detailed breakdown
      const [combinedResult] = await connection.execute(`
        SELECT 
          organik_non_organik,
          pusat_pelayanan,
          non_operasional,
          COUNT(*) as count
        FROM ptpdata ${whereClause}
        GROUP BY organik_non_organik, pusat_pelayanan, non_operasional
      `, params);

      await connection.end();

      // Process results - use same logic as SPMT
      let lakiLaki = 0, perempuan = 0;
      let organik = 0, nonOrganik = 0;
      let operasional = 0, nonOperasional = 0;
      let organikOperasional = 0, organikNonOperasional = 0;
      let nonOrganikOperasional = 0, nonOrganikNonOperasional = 0;

      // Process gender data
      (genderResult as any[]).forEach(row => {
        const gender = row.jenis_kelamin?.toUpperCase().trim();
        if (gender === 'L' || gender === 'LAKI-LAKI' || gender === 'LAKI LAKI' || gender === 'PRIA') {
          lakiLaki += row.count;
        } else if (gender === 'P' || gender === 'PEREMPUAN' || gender === 'WANITA') {
          perempuan += row.count;
        }
      });

      // Process organik data - DIRECTLY from organik_non_organik column
      (organikResult as any[]).forEach(row => {
        const organikValue = String(row.organik_non_organik || '').trim();
        if (!organikValue || organikValue === '') {
          // Skip empty values
          return;
        }
        
        const organikUpper = organikValue.toUpperCase();
        
        // Check for NON ORGANIK first (more specific)
        if (organikUpper.includes('NON') && organikUpper.includes('ORGANIK')) {
          nonOrganik += row.count;
        } 
        // Check for NON-ORGANIK (with hyphen)
        else if (organikUpper.includes('NON-ORGANIK')) {
          nonOrganik += row.count;
        }
        // Check for NON ORGANIK (with space)
        else if (organikUpper.includes('NON ORGANIK')) {
          nonOrganik += row.count;
        }
        // Check for just "NON" (might be non-organik)
        else if (organikUpper === 'NON' || organikUpper.startsWith('NON ')) {
          nonOrganik += row.count;
        }
        // Check for ORGANIK (but not NON)
        else if (organikUpper.includes('ORGANIK') && !organikUpper.includes('NON')) {
          organik += row.count;
        }
        // Check for exact match "ORGANIK"
        else if (organikUpper === 'ORGANIK') {
          organik += row.count;
        }
        // Default: if contains "ORGANIK" but unclear, assume organik
        else if (organikUpper.includes('ORGANIK')) {
          organik += row.count;
        }
        // If value exists but doesn't match patterns, log for debugging
        else {
          console.log(`PTP: Unrecognized organik_non_organik value: "${organikValue}"`);
          // Default to organik if value exists but unclear
          organik += row.count;
        }
      });

      // Process operasional data - PRIORITIZE non_operasional column (same as sdm-operasional-stats)
      (operasionalResult as any[]).forEach(row => {
        let status = '';
        
        // PRIORITIZE non_operasional column - it's the explicit status from Excel
        // This column explicitly states whether it's "Operasional" or "Non Operasional"
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
            // If it contains "NON", it's non-operasional
            status = 'non-operasional';
          } 
          // If it contains "OPERASIONAL" but NOT "NON", it's operasional
          else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
            status = 'operasional';
          }
          // Check for specific patterns in non_operasional
          else if (nonOpUpper.includes('OPERASI LANGSUNG')) {
            status = 'operasional';
          } else if (nonOpUpper.includes('OPERASI TIDAK LANGSUNG')) {
            status = 'operasional'; // OPERASI TIDAK LANGSUNG is still operasional
          } else if (nonOpUpper.includes('PENDUKUNG OPERASI') || nonOpUpper.includes('PENGELOLAAN')) {
            status = 'non-operasional';
          }
        }
        
        // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
        // This is a fallback, not a primary source
        if (!status && row.pusat_pelayanan) {
          const pusatPelayanan = String(row.pusat_pelayanan).toUpperCase().trim();
          if (pusatPelayanan.includes('OPERASI LANGSUNG')) {
            status = 'operasional';
          } else if (pusatPelayanan.includes('PENDUKUNG OPERASI') || pusatPelayanan.includes('PENGELOLAAN')) {
            status = 'non-operasional';
          } else if (pusatPelayanan.includes('OPERASIONAL') && !pusatPelayanan.includes('NON')) {
            status = 'operasional';
          } else if (pusatPelayanan.includes('NON OPERASIONAL') || pusatPelayanan.includes('NON-OPERASIONAL')) {
            status = 'non-operasional';
          } else if (pusatPelayanan.includes('OPERASI') && !pusatPelayanan.includes('NON')) {
            status = 'operasional';
          }
        }
        
        // Default fallback
        if (!status) {
            status = 'non-operasional';
        }
        
        // Add to appropriate counter
        if (status === 'operasional') {
          operasional += row.count;
        } else {
          nonOperasional += row.count;
        }
      });

      // Process combined data for detailed breakdown
      (combinedResult as any[]).forEach(row => {
        const organikValue = String(row.organik_non_organik || '').trim();
        const organikStatus = organikValue.toUpperCase();
        const pusatPelayanan = row.pusat_pelayanan?.toUpperCase().trim();
        const nonOp = row.non_operasional?.toUpperCase().trim();
        
        // Determine if organik or non-organik - DIRECTLY from organik_non_organik column
        let isOrganik = false;
        let isNonOrganik = false;
        
        if (organikValue && organikValue !== '') {
          // Check for NON ORGANIK first (more specific)
          if (organikStatus.includes('NON') && organikStatus.includes('ORGANIK')) {
            isNonOrganik = true;
          }
          // Check for NON-ORGANIK (with hyphen)
          else if (organikStatus.includes('NON-ORGANIK')) {
            isNonOrganik = true;
          }
          // Check for NON ORGANIK (with space)
          else if (organikStatus.includes('NON ORGANIK')) {
            isNonOrganik = true;
          }
          // Check for just "NON" (might be non-organik)
          else if (organikStatus === 'NON' || organikStatus.startsWith('NON ')) {
            isNonOrganik = true;
          }
          // Check for ORGANIK (but not NON)
          else if (organikStatus.includes('ORGANIK') && !organikStatus.includes('NON')) {
            isOrganik = true;
          }
          // Check for exact match "ORGANIK"
          else if (organikStatus === 'ORGANIK') {
            isOrganik = true;
          }
          // Default: if contains "ORGANIK" but unclear, assume organik
          else if (organikStatus.includes('ORGANIK')) {
            isOrganik = true;
          }
        }
        
        // Determine if operasional or non-operasional - PRIORITIZE non_operasional column
        let isOperasional = false;
        let isNonOperasional = false;
        
        // Check non_operasional first - PRIMARY source of truth
        if (nonOp && nonOp !== '') {
          if (nonOp === 'OPERASIONAL') {
            isOperasional = true;
          } else if (nonOp === 'NON OPERASIONAL' || nonOp === 'NON-OPERASIONAL') {
            isNonOperasional = true;
          } else if (nonOp.includes('NON')) {
            isNonOperasional = true;
          } else if (nonOp.includes('OPERASIONAL') && !nonOp.includes('NON')) {
            isOperasional = true;
          } else if (nonOp.includes('OPERASI LANGSUNG')) {
          isOperasional = true;
          } else if (nonOp.includes('PENDUKUNG OPERASI') || nonOp.includes('PENGELOLAAN')) {
          isNonOperasional = true;
          }
        }
        
        // ONLY if non_operasional is empty or unclear, check pusat_pelayanan as fallback
        if (!isOperasional && !isNonOperasional && pusatPelayanan) {
          if (pusatPelayanan.includes('OPERASI LANGSUNG') || pusatPelayanan.includes('OPERASIONAL')) {
          isOperasional = true;
          } else if (pusatPelayanan.includes('OPERASI TIDAK LANGSUNG') || pusatPelayanan.includes('NON OPERASIONAL')) {
          isNonOperasional = true;
          } else if (pusatPelayanan.includes('OPERASI') && !pusatPelayanan.includes('NON')) {
          isOperasional = true;
          } else if (pusatPelayanan.includes('PENGELOLAAN')) {
            isNonOperasional = true;
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

      const chartData = {
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
        total: totalEmployees
      };

      return NextResponse.json({
        success: true,
        data: {
          totalEmployees,
          chartData
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
        error: 'Failed to fetch PTP dashboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
