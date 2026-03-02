import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

interface UnitKerjaItem {
  id: string;
  nama: string;
  kode: string;
  unit_kerja: string;
  employee_count: number;
  ptp_daerah_id?: string;
}

export async function GET(_request: NextRequest) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Get PTP regions from ptp_daerah table
      const [ptpDaerahResult] = await connection.execute(`
        SELECT id, nama, kode FROM ptp_daerah ORDER BY id ASC
      `);

      // Get employee counts from ptpdata table for each region - sesuai dengan data di database
      const [employeeCounts] = await connection.execute(`
        SELECT 
          CASE 
            WHEN unit_kerja LIKE '%PTP-Kantor Pusat%' THEN 1
            WHEN unit_kerja LIKE '%PTP-CABANG TANJUNG PRIOK%' THEN 2
            WHEN unit_kerja LIKE '%PTP-CABANG BANTEN%' THEN 3
            WHEN unit_kerja LIKE '%PTP-CABANG CIREBON%' THEN 4
            WHEN unit_kerja LIKE '%PTP-CABANG PANGKA BALAM%' THEN 5
            WHEN unit_kerja LIKE '%PTP-CABANG TANJUNG BALAM%' THEN 6
            WHEN unit_kerja LIKE '%PTP-CABANG PALEMBANG%' THEN 7
            WHEN unit_kerja LIKE '%PTP-CABANG TELUK BAYUR%' THEN 8
            WHEN unit_kerja LIKE '%PTP-CABANG PANJANG%' THEN 9
            WHEN unit_kerja LIKE '%PTP-CABANG BENGKULU%' THEN 10
            WHEN unit_kerja LIKE '%PTP-CABANG JAMBI%' THEN 11
            WHEN unit_kerja LIKE '%PTP-CABANG PONTIANAK%' THEN 12
            ELSE NULL
          END as daerah_id,
          COUNT(*) as employee_count
        FROM ptpdata 
        WHERE unit_kerja IS NOT NULL AND unit_kerja != ''
        GROUP BY 
          CASE 
            WHEN unit_kerja LIKE '%PTP-Kantor Pusat%' THEN 1
            WHEN unit_kerja LIKE '%PTP-CABANG TANJUNG PRIOK%' THEN 2
            WHEN unit_kerja LIKE '%PTP-CABANG BANTEN%' THEN 3
            WHEN unit_kerja LIKE '%PTP-CABANG CIREBON%' THEN 4
            WHEN unit_kerja LIKE '%PTP-CABANG PANGKA BALAM%' THEN 5
            WHEN unit_kerja LIKE '%PTP-CABANG TANJUNG BALAM%' THEN 6
            WHEN unit_kerja LIKE '%PTP-CABANG PALEMBANG%' THEN 7
            WHEN unit_kerja LIKE '%PTP-CABANG TELUK BAYUR%' THEN 8
            WHEN unit_kerja LIKE '%PTP-CABANG PANJANG%' THEN 9
            WHEN unit_kerja LIKE '%PTP-CABANG BENGKULU%' THEN 10
            WHEN unit_kerja LIKE '%PTP-CABANG JAMBI%' THEN 11
            WHEN unit_kerja LIKE '%PTP-CABANG PONTIANAK%' THEN 12
            ELSE NULL
          END
        ORDER BY daerah_id ASC
      `);

      await connection.end();

      // Create employee count mapping
      const employeeCountMap = new Map();
      (employeeCounts as any[]).forEach(row => {
        if (row.daerah_id) {
          employeeCountMap.set(row.daerah_id, row.employee_count);
        }
      });

      // Calculate total employee count
      const totalEmployeeCount = (employeeCounts as any[]).reduce((sum, row) => sum + row.employee_count, 0);

      // Create unit kerja list based on ptp_daerah table
      const unitKerjaList: UnitKerjaItem[] = [];

      // Add regions from ptp_daerah table
      (ptpDaerahResult as any[]).forEach((daerah) => {
        unitKerjaList.push({
          id: daerah.id.toString(),
          nama: daerah.nama,
          kode: daerah.kode,
          unit_kerja: daerah.nama,
          employee_count: employeeCountMap.get(daerah.id) || 0,
          ptp_daerah_id: daerah.id.toString()
        });
      });

      return NextResponse.json({
        success: true,
        data: unitKerjaList
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('PTP Unit Kerja error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch PTP unit kerja list',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
