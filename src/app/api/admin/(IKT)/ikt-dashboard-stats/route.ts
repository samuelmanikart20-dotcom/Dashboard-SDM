  import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307
};

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const unitKerja = searchParams.get('unit_kerja');

    if (!bulan || !tahun) {
      return NextResponse.json({ message: 'Bulan dan tahun harus diisi' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // Build WHERE clause
    let whereClause = '';
    const params: any[] = [];

    if (bulan === 'all') {
      whereClause = 'WHERE tahun = ?';
      params.push(parseInt(tahun));
    } else {
      const bulanInt = parseInt(bulan);
      const tahunInt = parseInt(tahun);
      
      // Validate bulan is between 1-12
      if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
        return NextResponse.json({ message: 'Bulan tidak valid (harus 1-12 atau "all")' }, { status: 400 });
      }
      
      // Validate tahun is reasonable
      if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
        return NextResponse.json({ message: 'Tahun tidak valid' }, { status: 400 });
      }
      
      // Log for debugging
      console.log('IKT Dashboard Stats - Filtering with:', { bulan: bulanInt, tahun: tahunInt });
      
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
    }

    // Filter by unit_kerja for regional filtering
    if (unitKerja && unitKerja !== 'all') {
      if (unitKerja === 'IKT-KP' || unitKerja.includes('KP')) {
        // KANTOR PUSAT
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%', '%PUSAT%');
      } else if (unitKerja === 'IKT-JKT' || unitKerja.includes('JKT')) {
        // Branch Jakarta
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%Jakarta%', '%JAKARTA%', '%JKT%');
      } else if (unitKerja === 'IKT-BPP' || unitKerja.includes('BPP')) {
        // BALIKPAPAN
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BALIKPAPAN%', '%Balikpapan%');
      } else if (unitKerja === 'IKT-BJM' || unitKerja.includes('BJM')) {
        // BANJARMASIN
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BANJARMASIN%', '%Banjarmasin%');
      } else if (unitKerja === 'IKT-BLW' || unitKerja.includes('BLW')) {
        // BELAWAN
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BELAWAN%', '%Belawan%');
      } else if (unitKerja === 'IKT-MKS' || unitKerja.includes('MKS')) {
        // MAKASSAR
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%MAKASSAR%', '%Makassar%');
      } else if (unitKerja === 'IKT-PTK' || unitKerja.includes('PTK')) {
        // PONTIANAK
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%PONTIANAK%', '%Pontianak%');
      } else if (unitKerja === 'IKT-TPK' || unitKerja.includes('TPK')) {
        // TANJUNG PRIOK
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%TANJUNG PRIOK%', '%Tanjung Priok%', '%PRIOK%');
      } else {
        // Fallback: broad search
        whereClause += ' AND unit_kerja LIKE ?';
        params.push(`%${unitKerja}%`);
      }
    }

    // Debug: Get raw data to see actual values
    const [rawDataCheck] = await connection.execute(
      `SELECT pusat_pelayanan, non_operasional, status_laporan, COUNT(*) as count 
       FROM iktdata ${whereClause} 
       GROUP BY pusat_pelayanan, non_operasional, status_laporan`,
      params
    );

    // Get total employees
    const [totalResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM iktdata ${whereClause}`,
      params
    );
    const totalEmployees = (totalResult as any)[0].total;

    // Get organik vs non organik breakdown with flexible matching
    const [organikResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN organik_non_organik LIKE '%ORGANIK%' AND organik_non_organik NOT LIKE '%NON%' THEN 'Organik'
          WHEN organik_non_organik LIKE '%NON%' OR organik_non_organik LIKE '%Non%' THEN 'Non Organik'
          ELSE organik_non_organik
        END as organik_category,
        COUNT(*) as count
       FROM iktdata ${whereClause}
       GROUP BY organik_category`,
      params
    );

    // Get operasional vs non operasional breakdown - PRIORITIZE non_operasional column
    // Get raw data first, then process in JavaScript for better flexibility
    const [operasionalResult] = await connection.execute(
      `SELECT 
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
       FROM iktdata ${whereClause}
       GROUP BY pusat_pelayanan, non_operasional`,
      params
    );

    // Also get a simple count to see all data
    const [allDataSample] = await connection.execute(
      `SELECT pusat_pelayanan, non_operasional, status_laporan, COUNT(*) as count 
       FROM iktdata ${whereClause} 
       GROUP BY pusat_pelayanan, non_operasional, status_laporan 
       LIMIT 10`,
      params
    );


    // Get gender breakdown with flexible matching
    const [genderResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN jenis_kelamin = 'L' OR jenis_kelamin = 'Laki-laki' OR jenis_kelamin LIKE '%Laki%' THEN 'Laki-laki'
          WHEN jenis_kelamin = 'P' OR jenis_kelamin = 'Perempuan' OR jenis_kelamin LIKE '%Perempuan%' THEN 'Perempuan'
          ELSE jenis_kelamin
        END as gender_category,
        COUNT(*) as count
       FROM iktdata ${whereClause}
       GROUP BY gender_category`,
      params
    );

    // Get detailed breakdown (organik + operasional) - include raw columns for processing
    const [detailedResult] = await connection.execute(
      `SELECT 
        organik_non_organik,
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
       FROM iktdata ${whereClause}
       GROUP BY organik_non_organik, pusat_pelayanan, non_operasional`,
      params
    );

    // Process results with proper categorization
    const organikData = (organikResult as any[]).reduce((acc, row) => {
      if (row.organik_category === 'Organik') {
        acc.organik = row.count;
      } else if (row.organik_category === 'Non Organik') {
        acc.nonOrganik = row.count;
      }
      return acc;
    }, { organik: 0, nonOrganik: 0 });

    // Process operasional data - PRIORITIZE non_operasional column
    const operasionalData = (operasionalResult as any[]).reduce((acc, row) => {
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
        const pusatPelayanan = String(row.pusat_pelayanan).toUpperCase().trim();
        if (pusatPelayanan.includes('OPERASI LANGSUNG')) {
          status = 'operasional';
        } else if (pusatPelayanan.includes('PENDUKUNG OPERASI')) {
          status = 'non-operasional';
        } else if (pusatPelayanan.includes('OPERASIONAL') && !pusatPelayanan.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayanan.includes('NON OPERASIONAL') || pusatPelayanan.includes('NON-OPERASIONAL')) {
          status = 'non-operasional';
        }
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      if (status === 'operasional') {
        acc.operasional += row.count;
      } else {
        acc.nonOperasional += row.count;
      }
      
      return acc;
    }, { operasional: 0, nonOperasional: 0 });

    const genderData = (genderResult as any[]).reduce((acc, row) => {
      if (row.gender_category === 'Laki-laki') {
        acc.lakiLaki = row.count;
      } else if (row.gender_category === 'Perempuan') {
        acc.perempuan = row.count;
      }
      return acc;
    }, { lakiLaki: 0, perempuan: 0 });

    const detailedData = (detailedResult as any[]).reduce((acc, row) => {
      // Determine organik status
      const organikStatus = String(row.organik_non_organik || '').toUpperCase().trim();
      const isOrganik = organikStatus.includes('ORGANIK') && !organikStatus.includes('NON');
      const isNonOrganik = organikStatus.includes('NON') && organikStatus.includes('ORGANIK');
      
      // Determine operasional status - PRIORITIZE non_operasional column
      let isOperasional = false;
      let isNonOperasional = false;
      
      const nonOp = String(row.non_operasional || '').trim();
      const nonOpUpper = nonOp.toUpperCase();
      
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
      if (!isOperasional && !isNonOperasional && row.pusat_pelayanan) {
        const pusatPelayanan = String(row.pusat_pelayanan).toUpperCase().trim();
        if (pusatPelayanan.includes('OPERASI LANGSUNG')) {
          isOperasional = true;
        } else if (pusatPelayanan.includes('PENDUKUNG OPERASI')) {
          isNonOperasional = true;
        } else if (pusatPelayanan.includes('OPERASIONAL') && !pusatPelayanan.includes('NON')) {
          isOperasional = true;
        } else if (pusatPelayanan.includes('NON OPERASIONAL') || pusatPelayanan.includes('NON-OPERASIONAL')) {
          isNonOperasional = true;
        }
      }
      
      // Default fallback
      if (!isOperasional && !isNonOperasional) {
        isNonOperasional = true;
      }
      
      if (isOrganik && isOperasional) {
        acc.organikOperasional += row.count;
      } else if (isOrganik && isNonOperasional) {
        acc.organikNonOperasional += row.count;
      } else if (isNonOrganik && isOperasional) {
        acc.nonOrganikOperasional += row.count;
      } else if (isNonOrganik && isNonOperasional) {
        acc.nonOrganikNonOperasional += row.count;
      }
      return acc;
    }, { 
      organikOperasional: 0, 
      organikNonOperasional: 0, 
      nonOrganikOperasional: 0, 
      nonOrganikNonOperasional: 0 
    });

    const chartData = {
      ...organikData,
      ...operasionalData,
      ...genderData,
      ...detailedData,
      total: totalEmployees
    };


    return NextResponse.json({
      totalEmployees,
      chartData
    });

  } catch (error) {
    console.error('Error fetching IKT dashboard stats:', error);
    return NextResponse.json(
      { message: 'Error fetching dashboard statistics' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
