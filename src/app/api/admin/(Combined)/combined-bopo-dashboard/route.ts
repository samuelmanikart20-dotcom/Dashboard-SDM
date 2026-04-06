import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month');
    const year = url.searchParams.get('year') || '';
    const month = monthParam && monthParam !== 'all' ? monthParam : null;

    // For consolidation view (no specific month), skip BOPO aggregate
    if (!year || !month) {
      return new NextResponse(null, { status: 204 });
    }

    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo_revisi',
      port: Number(process.env.DB_PORT) || 3307
    });

    const tables = ['bopo_spmt', 'bopo_ptp', 'bopo_ikt', 'bopo_tcu'];

    const results: Array<{ bopo_ratio: number|null; produktivitas_efisiensi: number|null; rasio_beban_penghasilan_usaha: number|null; } | null> = [];

    for (const t of tables) {
      const sql = `SELECT 
          bopo_ratio,
          produktivitas_efisiensi,
          rasio_beban_penghasilan_usaha
        FROM ${t}
        WHERE bulan = ? AND tahun = ?
        ORDER BY id DESC
        LIMIT 1`;
      const [rows] = await conn.execute(sql, [month, year]);
      const row = (rows as any[])[0];
      if (row) {
        results.push({
          bopo_ratio: row.bopo_ratio != null ? Number(row.bopo_ratio) : null,
          produktivitas_efisiensi: row.produktivitas_efisiensi != null ? Number(row.produktivitas_efisiensi) : null,
          rasio_beban_penghasilan_usaha: row.rasio_beban_penghasilan_usaha != null ? Number(row.rasio_beban_penghasilan_usaha) : null,
        });
      } else {
        results.push(null);
      }
    }

    await conn.end();

    const nums = (arr: Array<number|null|undefined>) => arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const avg = (arr: Array<number|null|undefined>) => {
      const vals = nums(arr);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const bopo_ratio = avg(results.map(r => r?.bopo_ratio ?? null));
    const produktivitas_efisiensi = avg(results.map(r => r?.produktivitas_efisiensi ?? null));
    const rasio_beban_penghasilan_usaha = avg(results.map(r => r?.rasio_beban_penghasilan_usaha ?? null));

    return NextResponse.json({
      success: true,
      data: {
        bopo_ratio,
        produktivitas_efisiensi,
        rasio_beban_penghasilan_usaha,
        month,
        year,
      },
    });
  } catch (e: any) {
    console.error('combined-bopo-dashboard error', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
