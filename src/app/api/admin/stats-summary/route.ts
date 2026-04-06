import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(_request: NextRequest) {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);

    // Get SPMT stats
    const [spmtTotal] = await connection.execute(
      'SELECT COUNT(*) as total FROM spmtdata WHERE bulan IS NOT NULL AND tahun IS NOT NULL'
    );
    const spmtTotalRecords = (spmtTotal as any[])[0]?.total || 0;

    const [spmtDaerah] = await connection.execute(
      'SELECT COUNT(DISTINCT id) as total FROM daerah'
    );
    const spmtDaerahCount = (spmtDaerah as any[])[0]?.total || 0;

    // Get PTP stats
    const [ptpTotal] = await connection.execute(
      'SELECT COUNT(*) as total FROM ptpdata WHERE bulan IS NOT NULL AND tahun IS NOT NULL'
    );
    const ptpTotalRecords = (ptpTotal as any[])[0]?.total || 0;

    const [ptpDaerah] = await connection.execute(
      'SELECT COUNT(*) as total FROM ptp_daerah'
    );
    const ptpDaerahCount = (ptpDaerah as any[])[0]?.total || 0;

    // Get IKT stats - count ALL records (no filter)
    const [iktTotal] = await connection.execute(
      'SELECT COUNT(*) as total FROM iktdata'
    );
    const iktTotalRecords = (iktTotal as any[])[0]?.total || 0;

    // IKT has 8 fixed regions/cabang
    const iktDaerahCount = 8;

    // Get TCU stats - count ALL records (no filter)
    const [tcuTotal] = await connection.execute(
      'SELECT COUNT(*) as total FROM tcudata'
    );
    const tcuTotalRecords = (tcuTotal as any[])[0]?.total || 0;

    // Get TCU daerah count - check if tcu_daerah table exists, otherwise count distinct from tcudata
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'tcu_daerah'"
    );
    const hasTcuDaerahTable = Array.isArray(tables) && tables.length > 0;
    
    let tcuDaerahCount = 0;
    if (hasTcuDaerahTable) {
      const [tcuDaerah] = await connection.execute(
        'SELECT COUNT(*) as total FROM tcu_daerah'
      );
      tcuDaerahCount = (tcuDaerah as any[])[0]?.total || 0;
    } else {
      // Count distinct unit_kerja from tcudata to get actual regions
      // Get all distinct unit_kerja first
      const [tcuDistinctUnits] = await connection.execute(
        `SELECT DISTINCT unit_kerja 
         FROM tcudata 
         WHERE unit_kerja IS NOT NULL AND unit_kerja != ''
         ORDER BY unit_kerja ASC`
      );
      
      // Normalize and count unique regions
      const uniqueRegions = new Set<string>();
      (tcuDistinctUnits as any[]).forEach((row) => {
        const unitKerja = row.unit_kerja || '';
        if (unitKerja.includes('KANTOR PUSAT') || unitKerja.includes('Kantor Pusat')) {
          uniqueRegions.add('Kantor Pusat');
        } else if (unitKerja.includes('MEKAR PUTIH') || unitKerja.includes('Mekar Putih')) {
          uniqueRegions.add('Mekar Putih');
        } else {
          // Use the unit_kerja as is for other regions
          uniqueRegions.add(unitKerja.trim());
        }
      });
      
      tcuDaerahCount = uniqueRegions.size;
    }

    // Get available periods count
    const [spmtPeriods] = await connection.execute(
      `SELECT COUNT(DISTINCT CONCAT(bulan, '-', tahun)) as total 
       FROM spmtdata 
       WHERE bulan IS NOT NULL AND tahun IS NOT NULL`
    );
    const spmtPeriodCount = (spmtPeriods as any[])[0]?.total || 0;

    const [ptpPeriods] = await connection.execute(
      `SELECT COUNT(DISTINCT CONCAT(bulan, '-', tahun)) as total 
       FROM ptpdata 
       WHERE bulan IS NOT NULL AND tahun IS NOT NULL`
    );
    const ptpPeriodCount = (ptpPeriods as any[])[0]?.total || 0;

    const [iktPeriods] = await connection.execute(
      `SELECT COUNT(DISTINCT CONCAT(bulan, '-', tahun)) as total 
       FROM iktdata 
       WHERE bulan IS NOT NULL AND tahun IS NOT NULL`
    );
    const iktPeriodCount = (iktPeriods as any[])[0]?.total || 0;

    const [tcuPeriods] = await connection.execute(
      `SELECT COUNT(DISTINCT CONCAT(bulan, '-', tahun)) as total 
       FROM tcudata 
       WHERE bulan IS NOT NULL AND tahun IS NOT NULL`
    );
    const tcuPeriodCount = (tcuPeriods as any[])[0]?.total || 0;

    await connection.end();

    return NextResponse.json({
      success: true,
      data: {
        spmt: {
          daerahCount: spmtDaerahCount,
          periodeCount: spmtPeriodCount,
          totalRecords: spmtTotalRecords,
        },
        ptp: {
          daerahCount: ptpDaerahCount,
          periodeCount: ptpPeriodCount,
          totalRecords: ptpTotalRecords,
        },
        ikt: {
          daerahCount: iktDaerahCount,
          periodeCount: iktPeriodCount,
          totalRecords: iktTotalRecords,
        },
        tcu: {
          daerahCount: tcuDaerahCount,
          periodeCount: tcuPeriodCount,
          totalRecords: tcuTotalRecords,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching stats summary:', error);
    if (connection) {
      await connection.end();
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stats summary',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}













