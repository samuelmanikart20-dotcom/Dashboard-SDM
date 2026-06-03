import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import ExcelJS from 'exceljs'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {

  let connection: mysql.Connection | null = null

  try {

    const { searchParams } = new URL(request.url)
    const month      = searchParams.get('month')
    const year       = searchParams.get('year')
    const unitKerja  = searchParams.get('unit_kerja')
    const exportExcel = searchParams.get('export')
    const page       = parseInt(searchParams.get('page')  || '1')
    const limit      = parseInt(searchParams.get('limit') || '100')
    const offset     = (page - 1) * limit

    connection = await mysql.createConnection({
      host:     process.env.DB_HOST     || '127.0.0.1',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'spmt_pelindo_revisi',
      port:     Number(process.env.DB_PORT) || 3307,
    })

    // ── WHERE clause ─────────────────────────────────────────────────────────
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

    const bulanNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const bulanName = month && month !== 'all'
      ? (bulanNames[parseInt(month)] || month)
      : 'Semua'

    // ── Unit kerja filter (skip saat export agar semua unit masuk) ────────────
    if (exportExcel !== 'excel' && unitKerja && unitKerja !== 'all') {
      const [daerahRows]: any = await connection.execute(
        'SELECT id, nama, kode FROM ptp_daerah WHERE id = ?',
        [parseInt(unitKerja)]
      )

      if (daerahRows.length > 0) {
        const daerahInfo = daerahRows[0]

        const kodeToKeyword: Record<string, string> = {
          'KP':  'Kantor Pusat',
          'TPK': 'Tanjung Priok',
          'BTN': 'Banten',
          'CRB': 'Cirebon',
          'PKB': 'Pangka Balam',
          'TJB': 'Tanjung Balam',
          'PLB': 'Palembang',
          'TBY': 'Teluk Bayur',
          'PJG': 'Panjang',
          'BKL': 'Bengkulu',
          'JMB': 'Jambi',
          'PTK': 'Pontianak',
        }

        const unitKerjaFilter = kodeToKeyword[daerahInfo.kode]
          ?? daerahInfo.nama.replace('PTP ', '').trim()

        const upper = unitKerjaFilter.toUpperCase()
        where += ` AND (
          unit_kerja LIKE ? OR unit_kerja LIKE ? OR
          unit_kerja LIKE ? OR unit_kerja LIKE ? OR
          unit_kerja LIKE ? OR unit_kerja LIKE ?
        )`
        params.push(
          `%${unitKerjaFilter}%`, `%${upper}%`,
          `%PTP%${unitKerjaFilter}%`, `%PTP%${upper}%`,
          `%PTP-%${unitKerjaFilter}%`, `%PTP-%${upper}%`,
        )

        console.log('PTP Table – unit_kerja filter:', { kode: daerahInfo.kode, unitKerjaFilter })
      }
    }

    // ── Fetch all rows ────────────────────────────────────────────────────────
    const [allRows]: any = await connection.execute(
      `SELECT
        npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja, kategori,
        jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan,
        non_operasional, status_laporan, bulan, tahun
      FROM ptpdata
      ${where}
      ORDER BY nama ASC`,
      params
    )

    // =========================================================================
    // EXPORT EXCEL
    // =========================================================================
    if (exportExcel === 'excel') {

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('DATA PTP')

      const GREEN     = '1A5C38'
      const GREEN_SUB = 'D9EAD3'
      const GREEN_ROW = 'EAF4EA'
      const WHITE     = 'FFFFFF'
      const NCOLS     = 15

      const thin: Partial<ExcelJS.Borders> = {
        top:    { style: 'thin' as ExcelJS.BorderStyle },
        left:   { style: 'thin' as ExcelJS.BorderStyle },
        bottom: { style: 'thin' as ExcelJS.BorderStyle },
        right:  { style: 'thin' as ExcelJS.BorderStyle },
      }

      const C = { h: 'center' as const, v: 'middle' as const, wrapText: true }
      const L = { h: 'left'   as const, v: 'middle' as const, wrapText: true }

      // --- BARIS 1: JUDUL UTAMA ---
      ws.mergeCells(1, 1, 1, NCOLS)
      const b1 = ws.getCell('A1')
      b1.value     = 'DATA PTP - PELINDO'
      b1.font      = { name: 'Arial', bold: true, size: 14, color: { argb: WHITE } }
      b1.alignment = { horizontal: 'center', vertical: 'middle' }
      b1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
      ws.getRow(1).height = 32

      // --- BARIS 2: SUB JUDUL ---
      ws.mergeCells(2, 1, 2, NCOLS)
      const b2 = ws.getCell('A2')
      b2.value     = `Entitas: PTP  |  Bulan: ${bulanName}  |  Tahun: ${year || ''}`
      b2.font      = { name: 'Arial', size: 11, color: { argb: '000000' } }
      b2.alignment = { horizontal: 'center', vertical: 'middle' }
      b2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SUB } }
      ws.getRow(2).height = 22

      // --- BARIS 3: KOSONG ---
      ws.getRow(3).height = 8

      // --- BARIS 4: HEADER ---
      const headers = [
        'No', 'NPP', 'Nama', 'Tanggal Lahir', 'Jabatan', 'Entitas',
        'Unit Kerja', 'Kategori', 'Jenis Kelamin', 'Pendidikan',
        'Organik/Non Organik', 'Pusat Pelayanan', 'Non Operasional',
        'Status Laporan', 'Bulan'
      ]
      ws.getRow(4).height = 36
      headers.forEach((h, i) => {
        const cell     = ws.getRow(4).getCell(i + 1)
        cell.value     = h
        cell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: WHITE } }
        cell.alignment = C
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
        cell.border    = thin
      })

      // --- BARIS DATA ---
      allRows.forEach((item: any, idx: number) => {
        const row   = ws.getRow(idx + 5)
        row.height  = 18
        const bg    = idx % 2 === 0 ? GREEN_ROW : WHITE

        const tgl = item.tanggal_lahir
          ? new Date(item.tanggal_lahir).toLocaleDateString('id-ID', {
              day: '2-digit', month: 'long', year: 'numeric'
            })
          : ''

        const vals = [
          idx + 1, item.npp, item.nama, tgl,
          item.jabatan, item.entitas, item.unit_kerja, item.kategori,
          item.jenis_kelamin, item.pendidikan, item.organik_non_organik,
          item.pusat_pelayanan, item.non_operasional,
          item.status_laporan, item.bulan,
        ]

        vals.forEach((v, i) => {
          const cell     = row.getCell(i + 1)
          cell.value     = v ?? ''
          cell.font      = { name: 'Arial', size: 10 }
          cell.alignment = i === 0 ? C : L
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          cell.border    = thin
        })
      })

      // --- BARIS TOTAL ---
      const totalRowNum = allRows.length + 5
      ws.mergeCells(totalRowNum, 1, totalRowNum, NCOLS)
      const totalCell     = ws.getCell(totalRowNum, 1)
      totalCell.value     = `TOTAL: ${allRows.length} orang`
      totalCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: WHITE } }
      totalCell.alignment = { horizontal: 'center', vertical: 'middle' }
      totalCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
      totalCell.border    = thin
      ws.getRow(totalRowNum).height = 22

      // --- LEBAR KOLOM ---
      const widths = [5, 14, 28, 18, 30, 10, 28, 15, 14, 12, 22, 18, 18, 18, 8]
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

      // --- FREEZE HEADER ---
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }]

      const buffer = await wb.xlsx.writeBuffer()
      await connection.end()

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename=PTP_${bulanName}_${year || 'ALL'}.xlsx`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    }

    // ── PAGINATION (TABLE VIEW) ───────────────────────────────────────────────
    const total        = allRows.length
    const paginatedRows = allRows.slice(offset, offset + limit)
    await connection.end()

    return NextResponse.json({
      success: true,
      data: paginatedRows,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      }
    })

  } catch (error) {
    console.error('PTP TABLE API ERROR:', error)
    if (connection) { try { await connection.end() } catch {} }
    return NextResponse.json({
      success: false,
      error: 'Failed fetch ptp table',
      debug: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}