import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import * as XLSX from 'xlsx'

export const dynamic = "force-dynamic"; // 🔥 penting

export async function GET(request: NextRequest) {

  let connection: mysql.Connection | null = null

  try {

    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const daerahId = searchParams.get('daerah_id')
    const exportExcel = searchParams.get('export')

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

    // 🔥 AMBIL SEMUA DATA (untuk export)
    const [allRows]: any = await connection.execute(
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
      `,
      params
    )

    // 🔥 EXPORT EXCEL
    if (exportExcel === 'excel') {

      const formatted = allRows.map((item: any) => ({
        NPP: item.npp,
        Nama: item.nama,
        "Tanggal Lahir": item.tanggal_lahir,
        Jabatan: item.jabatan,
        Entitas: item.entitas,
        "Unit Kerja": item.unit_kerja,
        Kategori: item.kategori,
        "Jenis Kelamin": item.jenis_kelamin,
        Pendidikan: item.pendidikan,
        "Organik/Non Organik": item.organik_non_organik,
        "Pusat Pelayanan": item.pusat_pelayanan,
        "Non Operasional": item.non_operasional,
        "Status Laporan": item.status_laporan_rakomdir,
        Bulan: item.bulan,
        Tahun: item.tahun,
      }))

      const worksheet = XLSX.utils.json_to_sheet(formatted)
      const workbook = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(workbook, worksheet, 'SPMT')

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      })

      await connection.end()

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename=SPMT_${month}_${year}.xlsx`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    }

    // 🔥 PAGINATION (TABLE VIEW)
    const total = allRows.length

    const paginatedRows = allRows.slice(offset, offset + limit)

    await connection.end()

    return NextResponse.json({
      success: true,
      data: paginatedRows,
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