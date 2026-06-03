// ══════════════════════════════════════════════════════════════
// FILE: src/app/api/admin/(TCU)/tcu-table-data/route.ts
// ══════════════════════════════════════════════════════════════
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import ExcelJS from 'exceljs'

export const dynamic = "force-dynamic"

const dbConfig = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'spmt_pelindo_revisi',
  port:     Number(process.env.DB_PORT) || 3307,
}

// ── Helpers ──────────────────────────────────────────────────
const safeDate = (v: any): string => {
  if (!v) return ''
  const str = String(v)
  if (!str || str === '0000-00-00' || str === 'null') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const safeDateISO = (v: any): string => {
  if (!v) return ''
  const str = String(v)
  if (!str || str === '0000-00-00' || str === 'null') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
}

const s = (v: any): string =>
  v !== null && v !== undefined ? String(v).trim() : ''

const bulanNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null

  try {
    const { searchParams } = new URL(request.url)
    const bulan      = searchParams.get('bulan')
    const tahun      = searchParams.get('tahun')
    const unitKerja  = searchParams.get('unit_kerja')
    const exportExcel = searchParams.get('export')
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1',   10) || 1)
    const limit      = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100))

    if (!bulan || !tahun) {
      return NextResponse.json(
        { success: false, message: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      )
    }

    connection = await mysql.createConnection(dbConfig)

    // ── WHERE clause ─────────────────────────────────────────
    let whereClause = ''
    const params: (string | number)[] = []

    if (bulan === 'all') {
      const tahunInt = parseInt(tahun, 10)
      if (!isNaN(tahunInt)) {
        whereClause = 'WHERE tahun = ?'
        params.push(tahunInt)
      }
    } else {
      const bulanInt = parseInt(bulan, 10)
      const tahunInt = parseInt(tahun, 10)

      if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
        return NextResponse.json(
          { success: false, message: 'Bulan tidak valid (harus 1-12 atau "all")' },
          { status: 400 }
        )
      }
      if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
        return NextResponse.json(
          { success: false, message: 'Tahun tidak valid' },
          { status: 400 }
        )
      }

      whereClause = 'WHERE bulan = ? AND tahun = ?'
      params.push(bulanInt, tahunInt)
    }

    // ── Unit kerja filter (skip saat export Excel) ────────────
    if (exportExcel !== 'excel' && unitKerja && unitKerja !== 'all') {
      if (unitKerja === 'TCU-KP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)'
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%')
      } else if (unitKerja === 'TCU-SMP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)'
        params.push('%MEKAR PUTIH%', '%Mekar Putih%')
      } else {
        whereClause += ' AND unit_kerja LIKE ?'
        params.push(`%${unitKerja}%`)
      }
    }

    const bulanName = bulan && bulan !== 'all'
      ? (bulanNames[parseInt(bulan)] || bulan)
      : 'Semua'

    const COLS = `
      id, npp, nama, tanggal_lahir, jabatan, entitas,
      unit_kerja, kategori, jenis_kelamin, pendidikan,
      organik_non_organik, pusat_pelayanan, non_operasional,
      status_laporan, bulan, tahun
    `

    // =========================================================
    // EXPORT EXCEL
    // =========================================================
    if (exportExcel === 'excel') {

      const [exportRows] = await connection.execute(
        `SELECT ${COLS} FROM tcudata ${whereClause} ORDER BY nama ASC`,
        params
      )

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('DATA TCU')

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
      const b1     = ws.getCell('A1')
      b1.value     = 'DATA TCU - PELINDO'
      b1.font      = { name: 'Arial', bold: true, size: 14, color: { argb: WHITE } }
      b1.alignment = { horizontal: 'center', vertical: 'middle' }
      b1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
      ws.getRow(1).height = 32

      // --- BARIS 2: SUB JUDUL ---
      ws.mergeCells(2, 1, 2, NCOLS)
      const b2     = ws.getCell('A2')
      b2.value     = `Entitas: TCU  |  Bulan: ${bulanName}  |  Tahun: ${tahun || ''}`
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
      ;(exportRows as any[]).forEach((item, idx) => {
        const row  = ws.getRow(idx + 5)
        row.height = 18
        const bg   = idx % 2 === 0 ? GREEN_ROW : WHITE

        const vals = [
          idx + 1,
          s(item.npp),
          s(item.nama),
          safeDate(item.tanggal_lahir),
          s(item.jabatan),
          s(item.entitas),
          s(item.unit_kerja),
          s(item.kategori),
          s(item.jenis_kelamin),
          s(item.pendidikan),
          s(item.organik_non_organik),
          s(item.pusat_pelayanan),
          s(item.non_operasional),
          s(item.status_laporan),
          item.bulan ?? '',
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
      const allRows     = exportRows as any[]
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
      connection = null

      const labelMonth = bulan !== 'all' ? bulanName : 'ALL'
      const filename   = `TCU_${tahun}_${labelMonth}.xlsx`

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename=${filename}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    }

    // ── Count total ──────────────────────────────────────────
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM tcudata ${whereClause}`,
      params
    )
    const total      = (countResult as any)[0].total
    const totalPages = Math.ceil(total / limit)
    const offset     = Math.max(0, (page - 1) * limit)

    // ── Paginated data ────────────────────────────────────────
    const dataParams: (string | number)[] = [...params, limit, offset]

    const [rows] = await connection.execute(
      `SELECT ${COLS} FROM tcudata ${whereClause} ORDER BY nama ASC LIMIT ? OFFSET ?`,
      dataParams
    )

    const tableData = (rows as any[]).map(row => ({
      id:                  row.id,
      npp:                 s(row.npp),
      nama:                s(row.nama),
      tanggal_lahir:       safeDateISO(row.tanggal_lahir),
      jabatan:             s(row.jabatan),
      entitas:             s(row.entitas),
      unit_kerja:          s(row.unit_kerja),
      kategori:            s(row.kategori),
      jenis_kelamin:       s(row.jenis_kelamin),
      pendidikan:          s(row.pendidikan),
      organik_non_organik: s(row.organik_non_organik),
      pusat_pelayanan:     s(row.pusat_pelayanan),
      non_operasional:     s(row.non_operasional),
      status_laporan:      s(row.status_laporan),
      bulan:               row.bulan  ?? null,
      tahun:               row.tahun  ?? null,
    }))

    await connection.end()
    connection = null

    if (tableData.length > 0) {
      console.log('[tcu-table-data] sample[0]:', {
        nama:       tableData[0].nama,
        pendidikan: tableData[0].pendidikan,
        organik:    tableData[0].organik_non_organik,
      })
    }

    return NextResponse.json({
      success: true,
      data: tableData,
      pagination: {
        page, limit, total, totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })

  } catch (error) {
    console.error('[tcu-table-data] ERROR:', error)
    return NextResponse.json(
      { success: false, message: 'Error fetching table data: ' + (error as Error).message },
      { status: 500 }
    )
  } finally {
    if (connection) {
      try { await connection.end() } catch {}
    }
  }
}