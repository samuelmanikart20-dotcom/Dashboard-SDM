// ══════════════════════════════════════════════════════════════
// FILE: src/app/api/admin/(TCU)/tcu-table-data/route.ts
// ══════════════════════════════════════════════════════════════
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'spmt_pelindo_revisi',
  port:     Number(process.env.DB_PORT) || 3307,
}

// ── Format tanggal aman ──────────────────────────────────────
const safeDate = (v: any): string => {
  if (!v) return ''
  const str = String(v)
  if (!str || str === '0000-00-00' || str === 'null') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
}

const s = (v: any): string =>
  v !== null && v !== undefined ? String(v).trim() : ''

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null

  try {
    const { searchParams } = new URL(request.url)
    const bulan      = searchParams.get('bulan')
    const tahun      = searchParams.get('tahun')
    const unitKerja  = searchParams.get('unit_kerja')
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1',   10) || 1)
    const limit      = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100))
    const exportType = (searchParams.get('export') || '').toLowerCase()

    if (!bulan || !tahun) {
      return NextResponse.json(
        { success: false, message: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      )
    }

    connection = await mysql.createConnection(dbConfig)

    // ── Build WHERE clause ───────────────────────────────────
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

    // ── Unit kerja filter (skip saat export Excel) ───────────
    if (exportType !== 'excel' && unitKerja && unitKerja !== 'all') {
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

    const COLS = `
      id, npp, nama, tanggal_lahir, jabatan, entitas,
      unit_kerja, kategori, jenis_kelamin, pendidikan,
      organik_non_organik, pusat_pelayanan, non_operasional,
      status_laporan, bulan, tahun
    `

    // ── Excel export (tanpa pagination) ─────────────────────
    if (exportType === 'excel') {
      const XLSX = await import('xlsx')

      const [exportRows] = await connection.execute(
        `SELECT ${COLS} FROM tcudata ${whereClause} ORDER BY nama ASC`,
        params
      )

      const header = [
        'NPP', 'Nama', 'Tanggal Lahir', 'Jabatan', 'Entitas', 'Unit Kerja',
        'Kategori', 'Jenis Kelamin', 'Pendidikan', 'Organik/Non Organik',
        'Pusat Pelayanan', 'Non Operasional', 'Status Laporan', 'Bulan', 'Tahun',
      ]

      const rows = (exportRows as any[]).map(r => [
        s(r.npp),
        s(r.nama),
        safeDate(r.tanggal_lahir),
        s(r.jabatan),
        s(r.entitas),
        s(r.unit_kerja),
        s(r.kategori),
        s(r.jenis_kelamin),
        s(r.pendidikan),
        s(r.organik_non_organik),
        s(r.pusat_pelayanan),
        s(r.non_operasional),
        s(r.status_laporan),
        r.bulan ?? '',
        r.tahun ?? '',
      ])

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'TCU')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

      const labelMonth = bulan !== 'all' ? bulan : 'ALL'
      const filename   = `TCU_${tahun}_${labelMonth}.xlsx`

      await connection.end()
      connection = null

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control':       'no-store',
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

    // ── Paginated data ───────────────────────────────────────
    const dataParams: (string | number)[] = [...params, limit, offset]

    const [rows] = await connection.execute(
      `SELECT ${COLS} FROM tcudata ${whereClause} ORDER BY nama ASC LIMIT ? OFFSET ?`,
      dataParams
    )

    const tableData = (rows as any[]).map(row => ({
      id:                  row.id,
      npp:                 s(row.npp),
      nama:                s(row.nama),
      tanggal_lahir:       safeDate(row.tanggal_lahir),
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
        page,
        limit,
        total,
        totalPages,
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