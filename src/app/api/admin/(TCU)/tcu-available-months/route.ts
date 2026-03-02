import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
};

const monthNames = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export async function GET(_request: NextRequest) {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);

    // Get distinct months and years with record counts
    const [rows] = await connection.execute(`
      SELECT 
        bulan,
        tahun,
        COUNT(*) as totalRecords
      FROM tcudata 
      GROUP BY bulan, tahun 
      ORDER BY tahun DESC, bulan DESC
    `);

    const monthlyPeriods = (rows as any[]).map(row => {
      const bulan = parseInt(row.bulan);
      const tahun = parseInt(row.tahun);
      
      // Validate bulan is between 1-12
      if (isNaN(bulan) || bulan < 1 || bulan > 12) {
        console.warn(`TCU Available Months - Invalid bulan value: ${row.bulan}, skipping`);
        return null;
      }
      
      return {
        bulan: bulan,
        tahun: tahun,
        bulanName: monthNames[bulan] || `Bulan ${bulan}`,
        totalRecords: row.totalRecords,
        label: `${monthNames[bulan] || `Bulan ${bulan}`} ${tahun} (${row.totalRecords} data)`,
        value: `${bulan}-${tahun}`,
        type: 'month' as const
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null);

    // Get yearly consolidations
    const [yearlyRows] = await connection.execute(`
      SELECT 
        tahun,
        COUNT(*) as totalRecords
      FROM tcudata 
      GROUP BY tahun 
      ORDER BY tahun DESC
    `);

    const yearlyPeriods = (yearlyRows as any[]).map(row => ({
      bulan: 'all' as const,
      tahun: row.tahun,
      bulanName: 'Konsolidasi',
      totalRecords: row.totalRecords,
      label: `Konsolidasi ${row.tahun} (${row.totalRecords} data)`,
      value: `all-${row.tahun}`,
      type: 'consolidation' as const
    }));

    // Sort periods by year desc, then by consolidation first, then by month desc
    const allPeriods = [...yearlyPeriods, ...monthlyPeriods];
    allPeriods.sort((a, b) => {
      if (a.tahun !== b.tahun) {
        return b.tahun - a.tahun;
      }
      if (a.type !== b.type) {
        return a.type === 'consolidation' ? -1 : 1;
      }
      if (a.type === 'month' && b.type === 'month') {
        return (b.bulan as number) - (a.bulan as number);
      }
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: allPeriods
    });

  } catch (error) {
    console.error('TCU Available months error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch TCU available months',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
