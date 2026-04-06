import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
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
      console.log('TCU Dashboard Stats - Filtering with:', { bulan: bulanInt, tahun: tahunInt });
      
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
    }

    // Filter by unit_kerja for regional filtering
    if (unitKerja && unitKerja !== 'all') {
      if (unitKerja === 'TCU-KP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%');
      } else if (unitKerja === 'TCU-SMP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%MEKAR PUTIH%', '%Mekar Putih%');
      }
    }

    // Debug: Get raw data to see actual values
    const [rawDataCheck] = await connection.execute(
      `SELECT pusat_pelayanan, non_operasional, status_laporan, COUNT(*) as count 
       FROM tcudata ${whereClause} 
       GROUP BY pusat_pelayanan, non_operasional, status_laporan`,
      params
    );

    // Get total employees
    const [totalResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM tcudata ${whereClause}`,
      params
    );
    const totalEmployees = (totalResult as any)[0].total;

    // Get organik vs non organik breakdown with flexible matching
    const [organikResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN organik_non_organik LIKE '%NON%ORGANIK%' OR organik_non_organik LIKE '%NON ORGANIK%' OR organik_non_organik LIKE '%NON-ORGANIK%' OR organik_non_organik LIKE '%Non Organik%' OR organik_non_organik LIKE '%Non-Organik%' THEN 'Non Organik'
          WHEN organik_non_organik LIKE '%ORGANIK%' AND (organik_non_organik NOT LIKE '%NON%' AND organik_non_organik NOT LIKE '%Non%') THEN 'Organik'
          WHEN organik_non_organik IS NULL OR organik_non_organik = '' THEN 'Unknown'
          ELSE organik_non_organik
        END as organik_category,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY organik_category`,
      params
    );

    // Get operasional vs non operasional breakdown using multiple columns
    const [operasionalResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN non_operasional = 'OPERASIONAL' THEN 'OPERASIONAL'
          WHEN non_operasional = 'NON OPERASIONAL' THEN 'NON OPERASIONAL'
          WHEN pusat_pelayanan LIKE '%OPERASI LANGSUNG%' THEN 'OPERASIONAL'
          WHEN pusat_pelayanan LIKE '%PENDUKUNG OPERASI%' THEN 'NON OPERASIONAL'
          ELSE 'LAINNYA'
        END as operational_status,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY operational_status`,
      params
    );

    // Also get a simple count to see all data
    const [allDataSample] = await connection.execute(
      `SELECT pusat_pelayanan, non_operasional, status_laporan, COUNT(*) as count 
       FROM tcudata ${whereClause} 
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
       FROM tcudata ${whereClause}
       GROUP BY gender_category`,
      params
    );

    // Get detailed breakdown (organik + operasional)
    const [detailedResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN organik_non_organik LIKE '%NON%ORGANIK%' OR organik_non_organik LIKE '%NON ORGANIK%' OR organik_non_organik LIKE '%NON-ORGANIK%' OR organik_non_organik LIKE '%Non Organik%' OR organik_non_organik LIKE '%Non-Organik%' THEN 'Non Organik'
          WHEN organik_non_organik LIKE '%ORGANIK%' AND (organik_non_organik NOT LIKE '%NON%' AND organik_non_organik NOT LIKE '%Non%') THEN 'Organik'
          WHEN organik_non_organik IS NULL OR organik_non_organik = '' THEN 'Unknown'
          ELSE organik_non_organik
        END as organik_category,
        CASE 
          WHEN non_operasional = 'OPERASIONAL' THEN 'OPERASIONAL'
          WHEN non_operasional = 'NON OPERASIONAL' THEN 'NON OPERASIONAL'
          WHEN pusat_pelayanan LIKE '%OPERASI LANGSUNG%' THEN 'OPERASIONAL'
          WHEN pusat_pelayanan LIKE '%PENDUKUNG OPERASI%' THEN 'NON OPERASIONAL'
          ELSE 'LAINNYA'
        END as operational_status,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY organik_category, operational_status`,
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

    const operasionalData = (operasionalResult as any[]).reduce((acc, row) => {
      if (row.operational_status === 'OPERASIONAL') {
        acc.operasional = row.count;
      } else if (row.operational_status === 'NON OPERASIONAL') {
        acc.nonOperasional = row.count;
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
      const isOrganik = row.organik_category === 'Organik';
      const isOperasional = row.operational_status === 'OPERASIONAL';
      const isNonOperasional = row.operational_status === 'NON OPERASIONAL';
      
      
      if (isOrganik && isOperasional) {
        acc.organikOperasional = row.count;
      } else if (isOrganik && isNonOperasional) {
        acc.organikNonOperasional = row.count;
      } else if (!isOrganik && isOperasional) {
        acc.nonOrganikOperasional = row.count;
      } else if (!isOrganik && isNonOperasional) {
        acc.nonOrganikNonOperasional = row.count;
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
    console.error('Error fetching TCU dashboard stats:', error);
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
