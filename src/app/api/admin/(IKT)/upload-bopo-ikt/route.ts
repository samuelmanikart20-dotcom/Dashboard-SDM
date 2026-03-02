import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import * as XLSX from 'xlsx'
import { dbConfig } from '@/lib/db-config'

function normKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, ' ').trim()
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'string') {
    const cleaned = val.replace(/\./g, '').replace(/,/g, '.')
    const num = Number(cleaned)
    return isNaN(num) ? null : num
  }
  if (typeof val === 'number') return isNaN(val) ? null : val
  return null
}

function mapHeaders(row: Record<string, any>) {
  const mapped: any = {}
  for (const [k, v] of Object.entries(row)) {
    const nk = normKey(k)
    // Mapping untuk KODE (daerah kode)
    if (['daerah', 'daerah kode', 'kode daerah', 'kode'].includes(nk)) mapped.daerah_kode = String(v || '').trim()
    else if (['daerah id', 'id daerah'].includes(nk)) mapped.daerah_id = v
    // Mapping untuk BULAN
    else if (['bulan', 'month'].includes(nk)) mapped.bulan = v
    // Mapping untuk TAHUN
    else if (['tahun', 'year'].includes(nk)) mapped.tahun = v
    // Mapping untuk BOPO_RA atau BOPO_RATIO
    else if (['rasio bopo', 'bopo', 'bopo ratio', 'rasio bopo (%)', 'bopo_ratio', 'bopo_ra'].includes(nk)) mapped.bopo_ratio = v
    // Mapping untuk PRODUKTI atau PRODUKTIVITAS_EFISIENSI
    else if (['efisiensi', 'produktivitas', 'efisiensi produktivitas', 'produktivitas efisiensi', 'produktivitas_efisiensi', 'produkti'].includes(nk)) mapped.produktivitas_efisiensi = v
    // Mapping untuk RASIO_BEBAN_PENGHASILAN_USAHA
    else if (['rasio beban', 'rasio beban penghasilan', 'rasio beban penghasilan/usaha', 'rasio beban penghasilan usaha', 'rasio_beban_penghasilan_usaha'].includes(nk)) mapped.rasio_beban_penghasilan_usaha = v
    // Mapping untuk KETERANG BULAN atau KETERANGAN (diabaikan, hanya untuk display)
    else if (['keterangan', 'keterang bulan', 'keterang', 'notes', 'catatan'].includes(nk)) {
      // Keterangan bulan hanya untuk display, tidak perlu disimpan
      // Tapi kita bisa extract bulan dari sini jika perlu
    }
  }
  return mapped
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content-Type must be multipart/form-data' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: "Field 'file' is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (!rawRows.length) {
      return NextResponse.json({ success: false, error: 'File kosong / tidak ada data' }, { status: 400 })
    }

    const rows = rawRows.map(mapHeaders)

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if ((!r.daerah_id && !r.daerah_kode) || !r.bulan || !r.tahun) {
        return NextResponse.json({ success: false, error: `Baris ${i + 2}: wajib berisi Daerah (Kode atau ID), Bulan, dan Tahun` }, { status: 400 })
      }
    }

    const conn = await mysql.createConnection(dbConfig)
    try {
      await conn.beginTransaction()

      // Cache IKT daerah kode->id from ikt_daerah
      const [daerahRows] = await conn.execute('SELECT id, kode, nama FROM ikt_daerah ORDER BY id ASC')
      const kodeToId = new Map<string, number>()
      ;(daerahRows as any[]).forEach(d => {
        if (d.kode) {
          kodeToId.set(String(d.kode).trim().toUpperCase(), Number(d.id))
          // Log untuk debugging
          console.log(`IKT Upload - Mapping: ${d.kode} -> ID ${d.id} (${d.nama})`)
        }
      })
      
      // Log semua mapping yang tersedia
      console.log('IKT Upload - Available mappings:', Array.from(kodeToId.entries()))

      const insertSql = `
        INSERT INTO bopo_ikt (
          daerah_id, bopo_ratio, produktivitas_efisiensi, rasio_beban_penghasilan_usaha, bulan, tahun, keterangan
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          bopo_ratio = VALUES(bopo_ratio),
          produktivitas_efisiensi = VALUES(produktivitas_efisiensi),
          rasio_beban_penghasilan_usaha = VALUES(rasio_beban_penghasilan_usaha),
          keterangan = VALUES(keterangan),
          updated_at = CURRENT_TIMESTAMP
      `

      let inserted = 0
      let updated = 0

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        let daerahId: number | null = null
        if (r.daerah_id) daerahId = Number(r.daerah_id)
        if (!daerahId && r.daerah_kode) {
          const kodeUpper = String(r.daerah_kode).trim().toUpperCase()
          const tryId = kodeToId.get(kodeUpper)
          if (tryId) {
            daerahId = tryId
            console.log(`IKT Upload - Baris ${i + 2}: Kode '${kodeUpper}' mapped ke ID ${daerahId}`)
          } else {
            console.error(`IKT Upload - Baris ${i + 2}: Kode '${kodeUpper}' tidak ditemukan. Available:`, Array.from(kodeToId.keys()))
          }
        }
        if (!daerahId) {
          throw new Error(`Baris ${i + 2}: Daerah tidak ditemukan untuk kode '${r.daerah_kode || r.daerah_id}'. Kode yang tersedia: ${Array.from(kodeToId.keys()).join(', ')}`)
        }
        
        console.log(`IKT Upload - Baris ${i + 2}: Inserting BOPO untuk daerah_id=${daerahId}, bulan=${r.bulan}, tahun=${r.tahun}, bopo_ratio=${r.bopo_ratio}`)

        const bulan = Number(r.bulan)
        const tahun = Number(r.tahun)
        if (!bulan || !tahun) {
          throw new Error(`Baris ${i + 2}: Bulan/Tahun tidak valid`)
        }

        const params = [
          daerahId,
          toNumber(r.bopo_ratio),
          toNumber(r.produktivitas_efisiensi),
          toNumber(r.rasio_beban_penghasilan_usaha),
          bulan,
          tahun,
          r.keterangan ? String(r.keterangan) : null,
        ]

        const [res] = await conn.execute(insertSql, params)
        const ar = (res as any).affectedRows as number
        if (ar === 1) inserted += 1
        else if (ar === 2) updated += 1
      }

      await conn.commit()
      await conn.end()

      return NextResponse.json({ success: true, message: `Upload selesai. Ditambahkan: ${inserted}, Diperbarui: ${updated}` })
    } catch (err) {
      await (await conn).rollback()
      await (await conn).end()
      console.error('Upload BOPO IKT error:', err)
      return NextResponse.json({ success: false, error: (err as Error).message || 'Gagal mengunggah data' }, { status: 500 })
    }
  } catch (error) {
    console.error('Upload BOPO IKT failed:', error)
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 })
  }
}
