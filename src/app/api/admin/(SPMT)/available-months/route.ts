import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { dbConfig } from "@/lib/db-config";

export async function GET() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // Check if table exists
      const [tables] = await connection.execute("SHOW TABLES LIKE 'spmtdata'");
      if ((tables as any[]).length === 0) {
        return NextResponse.json({ periods: [], years: [] });
      }

      // Get distinct month and year combinations
      const [monthRows] = await connection.execute(`
        SELECT DISTINCT bulan, tahun, COUNT(*) as total_records
        FROM spmtdata 
        WHERE bulan IS NOT NULL AND tahun IS NOT NULL
        GROUP BY bulan, tahun 
        ORDER BY tahun DESC, bulan DESC
      `);

      // Get distinct years for consolidation
      const [yearRows] = await connection.execute(`
        SELECT tahun, SUM(total_records) as total_records
        FROM (
          SELECT DISTINCT bulan, tahun, COUNT(*) as total_records
          FROM spmtdata 
          WHERE tahun IS NOT NULL
          GROUP BY bulan, tahun
        ) as monthly_totals
        GROUP BY tahun 
        ORDER BY tahun DESC
      `);

      // Get total count for global consolidation
      const [totalResult] = await connection.execute(`
        SELECT COUNT(*) as total_records
        FROM spmtdata 
        WHERE bulan IS NOT NULL AND tahun IS NOT NULL
      `);
      const totalRecords = (totalResult as any[])[0]?.total_records || 0;

      const bulanNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];

      // Build individual month periods
      const periods = (monthRows as any[]).map(row => ({
        bulan: row.bulan,
        tahun: row.tahun,
        bulanName: bulanNames[row.bulan - 1],
        totalRecords: row.total_records,
        label: `${bulanNames[row.bulan - 1]} ${row.tahun} (${row.total_records} data)`,
        value: `${row.bulan}-${row.tahun}`,
        type: 'month'
      }));

      // Build consolidation options for each year (seperti di PTP)
   

      // Gabungkan konsolidasi per tahun dengan bulan individual (seperti di PTP)
      const finalPeriods: any[] = [];
      
      // Group periods by year
      const periodsByYear = new Map<number, any[]>();
      periods.forEach(p => {
        const year = p.tahun;
        if (!periodsByYear.has(year)) {
          periodsByYear.set(year, []);
        }
        periodsByYear.get(year)!.push(p);
      });
      
      // Add consolidation for each year, then its months
  
      // Add any remaining periods (if any year doesn't have consolidation)
      periods.forEach(p => {
        if (!finalPeriods.find(fp => fp.value === p.value)) {
          finalPeriods.push(p);
        }
      });
      
      // Sort: consolidation first, then months (descending by year and month)
      finalPeriods.sort((a, b) => {
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

      const years = (yearRows as any[]).map(row => ({
        tahun: row.tahun,
        totalRecords: row.total_records
      }));

      return NextResponse.json({ 
        periods: finalPeriods,
        years: years 
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error("Error fetching available months:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data bulan" }, { status: 500 });
  }
}
