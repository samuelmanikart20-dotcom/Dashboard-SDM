import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { dbConfig } from '../../../../../lib/db-config'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const daerahIdParam = searchParams.get('daerah_id')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    if (!daerahIdParam) {
      return NextResponse.json({ success: false, error: 'daerah_id is required' }, { status: 400 })
    }

    const daerah_id = Number(daerahIdParam)
    const month = monthParam ? Number(monthParam) : null
    const year = yearParam ? Number(yearParam) : null

    const conn = await mysql.createConnection(dbConfig)

    let query = `
      SELECT 
        bopo_ratio,
        produktivitas_efisiensi,
        rasio_beban_penghasilan_usaha,
        bulan,
        tahun
      FROM bopo_tcu
      WHERE daerah_id = ?
    `
    const params: any[] = [daerah_id]

    if (month && year) {
      query += ' AND bulan = ? AND tahun = ?'
      params.push(month, year)
    }

    query += ' ORDER BY tahun DESC, bulan DESC LIMIT 1'

    const [rows] = await conn.execute(query, params)
    await conn.end()

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    const row = (rows as any[])[0]

    return NextResponse.json({
      success: true,
      data: {
        bopo_ratio: row.bopo_ratio ?? null,
        produktivitas_efisiensi: row.produktivitas_efisiensi ?? null,
        rasio_beban_penghasilan_usaha: row.rasio_beban_penghasilan_usaha ?? null,
        bulan: row.bulan ?? null,
        tahun: row.tahun ?? null,
      },
    })
  } catch (error) {
    console.error('Error fetching BOPO TCU dashboard data:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch BOPO TCU data' }, { status: 500 })
  }
}
