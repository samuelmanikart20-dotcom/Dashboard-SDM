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

    // daerah_id dari frontend adalah ID dari ikt_daerah (1-8 untuk 8 cabang)
    const ikt_daerah_id = Number(daerahIdParam)
    const month = monthParam ? Number(monthParam) : null
    const year = yearParam ? Number(yearParam) : null

    const conn = await mysql.createConnection(dbConfig)

    // Log untuk debugging
    console.log(`BOPO IKT Dashboard - Fetching: daerah_id=${ikt_daerah_id}, month=${month}, year=${year}`)

    // Query bopo_ikt menggunakan ikt_daerah_id langsung
    // Karena upload-bopo-ikt sudah menggunakan ikt_daerah.id untuk insert ke bopo_ikt.daerah_id
    let query = `
      SELECT 
        bopo_ratio,
        produktivitas_efisiensi,
        rasio_beban_penghasilan_usaha,
        bulan,
        tahun,
        daerah_id
      FROM bopo_ikt
      WHERE daerah_id = ?
    `
    const params: any[] = [ikt_daerah_id]
    
    // Get daerah info for logging
    const [daerahInfo] = await conn.execute('SELECT id, kode, nama FROM ikt_daerah WHERE id = ?', [ikt_daerah_id])
    if ((daerahInfo as any[]).length > 0) {
      const info = (daerahInfo as any[])[0]
      console.log(`BOPO IKT Dashboard - Daerah: ${info.kode} (${info.nama})`)
    }

    if (month && year) {
      query += ' AND bulan = ? AND tahun = ?'
      params.push(month, year)
    }

    query += ' ORDER BY tahun DESC, bulan DESC LIMIT 1'

    const [rows] = await conn.execute(query, params)
    
    console.log(`BOPO IKT Dashboard - Found ${(rows as any[]).length} record(s)`)
    if ((rows as any[]).length > 0) {
      const row = (rows as any[])[0]
      console.log(`BOPO IKT Dashboard - Data: daerah_id=${row.daerah_id}, bulan=${row.bulan}, tahun=${row.tahun}, bopo_ratio=${row.bopo_ratio}`)
    }
    
    await conn.end()

    if ((rows as any[]).length === 0) {
      console.log(`BOPO IKT Dashboard - No data found for daerah_id=${ikt_daerah_id}`)
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
    console.error('Error fetching BOPO IKT dashboard data:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch BOPO IKT data' }, { status: 500 })
  }
}
