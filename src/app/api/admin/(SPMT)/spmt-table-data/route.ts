import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

export async function GET(request: NextRequest) {

  let connection: mysql.Connection | null = null

  try {

    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const daerahId = searchParams.get('daerah_id')

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = (page - 1) * limit

    connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307
})



    let where = 'WHERE 1=1'
    const params: any[] = []



    if (month && month !== 'all') {
      where += ' AND bulan = ?'
      params.push(parseInt(month))
    }

    if (year && year !== 'all') {
      where += ' AND tahun = ?'
      params.push(parseInt(year))
    }



    // FILTER DAERAH
    if (daerahId && daerahId !== '0') {

      const [daerahRows]: any = await connection.execute(
        'SELECT nama FROM daerah WHERE id=?',
        [parseInt(daerahId)]
      )

      if (daerahRows.length > 0) {

        const keyword = daerahRows[0].nama

        where += ' AND unit_kerja LIKE ?'
        params.push(`%${keyword}%`)
      }
    }



    // TOTAL DATA
    const [countRows]: any = await connection.execute(
      `SELECT COUNT(*) as total FROM spmtdata ${where}`,
      params
    )

    const total = countRows[0].total



    // DATA QUERY
    const [rows] = await connection.execute(
      `
      SELECT 
      npp,
      nama,
      tanggal_lahir,
      jabatan,
      entitas,
      unit_kerja,
      kategori,
      jenis_kelamin,
      pendidikan,
      organik_non_organik,
      pusat_pelayanan,
      non_operasional,
      status_laporan_rakomdir,
      bulan,
      tahun
      FROM spmtdata
      ${where}
      ORDER BY nama ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )



    await connection.end()



    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })


  } catch (error) {

  console.error('SPMT TABLE API ERROR:', error)

  return NextResponse.json({
    success:false,
    error:'Failed fetch spmt table',
    debug: error instanceof Error ? error.message : error
  },{status:500})

}
}