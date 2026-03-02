import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

interface Period {
  bulan: number | 'all';
  tahun: number;
  bulanName: string;
  totalRecords: number;
  label: string;
  value: string;
  type: 'consolidation' | 'month';
}

export async function GET(request: NextRequest) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Get available months and years with record counts
      const [monthsResult] = await connection.execute(`
        SELECT 
          bulan, 
          tahun, 
          COUNT(*) as totalRecords
        FROM ptpdata 
        WHERE bulan IS NOT NULL AND tahun IS NOT NULL
        GROUP BY bulan, tahun
        ORDER BY tahun DESC, bulan DESC
      `);

      // Get years for consolidation
      const [yearsResult] = await connection.execute(`
        SELECT 
          tahun, 
          COUNT(*) as totalRecords
        FROM ptpdata 
        WHERE tahun IS NOT NULL
        GROUP BY tahun
        ORDER BY tahun DESC
      `);

      await connection.end();

      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      // Create periods array
      const periods: Period[] = [];

      // Add consolidation periods for each year
    //  (yearsResult as any[]).forEach(yearRow => {
     //   periods.push({
     //     bulan: 'all',
      //    tahun: yearRow.tahun,
      //    bulanName: 'Konsolidasi',
      //    totalRecords: yearRow.totalRecords,
      //    label: `Konsolidasi ${yearRow.tahun} (${yearRow.totalRecords} data)`,
      //    value: `all-${yearRow.tahun}`,
      //    type: 'consolidation'
      //  });
    //  });

      // Add individual months
      (monthsResult as any[]).forEach(monthRow => {
        const monthName = months[monthRow.bulan - 1] || `Bulan ${monthRow.bulan}`;
        periods.push({
          bulan: monthRow.bulan,
          tahun: monthRow.tahun,
          bulanName: monthName,
          totalRecords: monthRow.totalRecords,
          label: `${monthName} ${monthRow.tahun} (${monthRow.totalRecords} data)`,
          value: `${monthRow.bulan}-${monthRow.tahun}`,
          type: 'month'
        });
      });

      // Sort periods by year desc, then by consolidation first, then by month desc
      periods.sort((a, b) => {
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
        data: periods
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('PTP Available months error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch PTP available months',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
