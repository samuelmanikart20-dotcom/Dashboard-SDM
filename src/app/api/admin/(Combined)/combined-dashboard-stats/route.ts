// src/app/api/admin/combined-dashboard-stats/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

function buildWhere(month?: string|null, year?: string) {
  const params: number[] = [];
  if (year && month) {
    const bulanInt = Math.floor(parseInt(month, 10));
    const tahunInt = Math.floor(parseInt(year, 10));
    
    // Validate bulan is between 1-12
    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      return { where: '1=0', params: [] }; // Return no results for invalid month
    }
    
    // Validate tahun is reasonable
    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      return { where: '1=0', params: [] }; // Return no results for invalid year
    }
    
    // Use integers for proper comparison with database
    return { where: 'bulan = ? AND tahun = ?', params: [bulanInt, tahunInt] };
  } else if (year) {
    const tahunInt = Math.floor(parseInt(year, 10));
    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      return { where: '1=0', params: [] };
    }
    return { where: 'tahun = ?', params: [tahunInt] };
  }
  return { where: '1=0', params: [] };
}

async function sumForTable(conn: mysql.Connection, table: string, month: string|null, year: string) {
  const { where, params } = buildWhere(month, year);
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN UPPER(TRIM(organik_non_organik)) LIKE '%ORGANIK%' THEN 1 ELSE 0 END) AS organik,
      SUM(CASE WHEN UPPER(TRIM(organik_non_organik)) LIKE '%NON%' THEN 1 ELSE 0 END) AS nonOrganik,
      SUM(CASE 
        WHEN UPPER(TRIM(pusat_pelayanan)) LIKE '%OPERASIONAL%' THEN 1
        WHEN UPPER(TRIM(non_operasional)) LIKE '%OPERASIONAL%' THEN 1
        ELSE 0 END
      ) AS operasional,
      SUM(CASE 
        WHEN UPPER(TRIM(pusat_pelayanan)) LIKE '%NON OPERASIONAL%' THEN 1
        WHEN UPPER(TRIM(non_operasional)) LIKE '%NON OPERASIONAL%' THEN 1
        ELSE 0 END
      ) AS nonOperasional,
      SUM(CASE WHEN UPPER(TRIM(jenis_kelamin)) LIKE 'L%' THEN 1 ELSE 0 END) AS lakiLaki,
      SUM(CASE WHEN UPPER(TRIM(jenis_kelamin)) LIKE 'P%' THEN 1 ELSE 0 END) AS perempuan,
      SUM(CASE 
        WHEN UPPER(TRIM(organik_non_organik)) LIKE '%ORGANIK%'
         AND (UPPER(TRIM(pusat_pelayanan)) LIKE '%OPERASIONAL%' OR UPPER(TRIM(non_operasional)) LIKE '%OPERASIONAL%')
        THEN 1 ELSE 0 END) AS organikOperasional,
      SUM(CASE 
        WHEN UPPER(TRIM(organik_non_organik)) LIKE '%ORGANIK%'
         AND (UPPER(TRIM(pusat_pelayanan)) LIKE '%NON OPERASIONAL%' OR UPPER(TRIM(non_operasional)) LIKE '%NON OPERASIONAL%')
        THEN 1 ELSE 0 END) AS organikNonOperasional,
      SUM(CASE 
        WHEN UPPER(TRIM(organik_non_organik)) LIKE '%NON%'
         AND (UPPER(TRIM(pusat_pelayanan)) LIKE '%OPERASIONAL%' OR UPPER(TRIM(non_operasional)) LIKE '%OPERASIONAL%')
        THEN 1 ELSE 0 END) AS nonOrganikOperasional,
      SUM(CASE 
        WHEN UPPER(TRIM(organik_non_organik)) LIKE '%NON%'
         AND (UPPER(TRIM(pusat_pelayanan)) LIKE '%NON OPERASIONAL%' OR UPPER(TRIM(non_operasional)) LIKE '%NON OPERASIONAL%')
        THEN 1 ELSE 0 END) AS nonOrganikNonOperasional
    FROM ${table}
    WHERE ${where}
  `;
  const [rows] = await conn.execute(sql, params);
  return (rows as any[])[0];
}

export async function GET(req: Request) {
  let conn: mysql.Connection | null = null;
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month');
    const year = url.searchParams.get('year') || '';

    const month = monthParam && monthParam !== 'all' ? monthParam : null;
    
    // Log for debugging
    console.log('Combined Dashboard Stats - Filtering with:', { month, year, monthParam });

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    const tables = ['spmtdata', 'ptpdata', 'iktdata', 'tcudata'];
    const parts = await Promise.all(tables.map(t => sumForTable(conn, t, month, year)));

    // Aggregate
    const agg = parts.reduce((acc, cur) => {
      for (const k of Object.keys(cur)) {
        acc[k] = (acc[k] || 0) + (Number(cur[k]) || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    const chartData = {
      organik: agg.organik || 0,
      nonOrganik: agg.nonOrganik || 0,
      operasional: agg.operasional || 0,
      nonOperasional: agg.nonOperasional || 0,
      lakiLaki: agg.lakiLaki || 0,
      perempuan: agg.perempuan || 0,
      organikOperasional: agg.organikOperasional || 0,
      organikNonOperasional: agg.organikNonOperasional || 0,
      nonOrganikOperasional: agg.nonOrganikOperasional || 0,
      nonOrganikNonOperasional: agg.nonOrganikNonOperasional || 0,
      total: agg.total || 0,
    };

    await conn.end();
    conn = null;

    return NextResponse.json({
      success: true,
      data: { totalEmployees: chartData.total, chartData },
    });
  } catch (e: any) {
    console.error('combined-dashboard-stats error', e);
    if (conn) {
      try {
        await conn.end();
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr);
      }
    }
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}