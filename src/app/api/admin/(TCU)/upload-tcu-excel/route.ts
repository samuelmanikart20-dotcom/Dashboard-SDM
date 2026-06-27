export const runtime = 'nodejs'

import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import mysql from "mysql2/promise"

// ══════════════════════════════════════════════════════════════
// FILE: src/app/api/admin/(TCU)/upload-tcu-excel/route.ts
// ══════════════════════════════════════════════════════════════

const normalize = (val: any): string | null =>
  val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== 'null'
    ? String(val).trim()
    : null

// ── Helper: coba beberapa kemungkinan nama kolom ─────────────
const pick = (row: any, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = normalize(row[k])
    if (v) return v
  }
  return null
}

// ── Normalisasi jenis kelamin ────────────────────────────────
const normalizeGender = (raw: string | null): string => {
  if (!raw) return '-'
  const v = raw.toLowerCase().trim()
  if (v === 'laki-laki' || v === 'laki' || v === 'l') return 'Laki-laki'
  if (v === 'perempuan' || v === 'p') return 'Perempuan'
  return raw
}

// ── Normalisasi organik/non-organik ─────────────────────────
const normalizeOrganik = (raw: string | null): string => {
  if (!raw) return '-'
  const v = raw.toLowerCase().trim()
  if (v.includes('non organik') || v.includes('non-organik')) return 'Non Organik'
  if (v.includes('organik')) return 'Organik'
  return raw
}

// ── Normalisasi pendidikan ───────────────────────────────────
const normalizePendidikan = (raw: string | null): string | null => {
  if (!raw) return null
  const v = raw.toUpperCase().trim()
  if (['S3', 'DOKTOR', 'DOCTOR', 'S-3'].includes(v)) return 'S3'
  if (['S2', 'MAGISTER', 'MASTER', 'S-2'].includes(v)) return 'S2'
  if (['S1', 'SARJANA', 'S-1'].includes(v)) return 'S1'
  if (['D4', 'D-4'].includes(v)) return 'D4'
  if (['D3', 'DIPLOMA', 'D-3'].includes(v)) return 'D3'
  if (['D2', 'D-2'].includes(v)) return 'D2'
  if (['D1', 'D-1'].includes(v)) return 'D1'
  if (['SMA', 'SMK', 'SMA/SMK', 'SMK/SMA'].includes(v)) return 'SMA/SMK'
  if (v === 'SMP') return 'SMP'
  if (v === 'SD') return 'SD'
  return raw.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const buffer = Buffer.from(body.file)

    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const finalData: any[] = []

    // ── 1. BACA SEMUA SHEET ──────────────────────────────────
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet)

      const cleaned = data.map((row: any) => {
        // ── Nama (coba berbagai casing) ──────────────────────
        const nama = pick(row, 'Nama', 'NAMA', 'nama') || '-'

        // ── Jabatan ──────────────────────────────────────────
        const jabatan = pick(row, 'Jabatan', 'JABATAN', 'NAMA JABATAN', 'Nama Jabatan') || '-'

        // ── Jenis Kelamin ────────────────────────────────────
        //   File export: "Jenis Kelamin"
        //   File template lama: "JENIS KELAMIN"
        const jkRaw = pick(row, 'Jenis Kelamin', 'JENIS KELAMIN', 'jenis_kelamin')
        const jenis_kelamin = normalizeGender(jkRaw)

        // ── Organik / Non Organik ────────────────────────────
        //   File export: "Organik/Non Organik"
        //   File template lama: "JENIS PEKERJA (ORGANIK/NON ORGANIK)"
        const organikRaw = pick(
          row,
          'Organik/Non Organik',
          'ORGANIK/NON ORGANIK',
          'JENIS PEKERJA (ORGANIK/NON ORGANIK)',
          'Jenis Pekerja',
          'Kategori',
          'kategori'
        )
        const organik_non_organik = normalizeOrganik(organikRaw)

        // ── Pendidikan ───────────────────────────────────────
        //   ⚠️  INI PENYEBAB UTAMA GRAFIK KOSONG
        //   File export: "Pendidikan"
        //   File template lama: "PENDIDIKAN"
        const pendidikanRaw = pick(row, 'Pendidikan', 'PENDIDIKAN', 'pendidikan')
        const pendidikan = normalizePendidikan(pendidikanRaw)

        // ── Unit Kerja ───────────────────────────────────────
        const unit_kerja = pick(row, 'Unit Kerja', 'UNIT KERJA', 'unit_kerja') || '-'

        // ── Kategori ─────────────────────────────────────────
        const kategori = pick(row, 'Kategori', 'KATEGORI', 'kategori') || '-'

        // ── Pusat Pelayanan ──────────────────────────────────
        const pusat_pelayanan = pick(row, 'Pusat Pelayanan', 'PUSAT PELAYANAN', 'PUSAT PELAYANAN OPERASIONAL/NON OPERASIONAL') || null

        // ── Non Operasional ──────────────────────────────────
        const non_operasional = pick(row, 'Non Operasional', 'NON OPERASIONAL', 'non_operasional') || null

        // ── Status Laporan ───────────────────────────────────
        const status_laporan = pick(row, 'Status Laporan', 'STATUS LAPORAN', 'STATUS LAPORAN RAKOMDIR') || '-'

        // ── Tanggal Lahir ────────────────────────────────────
        const tanggal_lahir = pick(row, 'Tanggal Lahir', 'TANGGAL LAHIR', 'tanggal_lahir')

        // ── NPP ──────────────────────────────────────────────
        const npp = pick(row, 'NPP', 'npp') || `TCU_${Date.now()}_${Math.floor(Math.random() * 1000)}`

        // ── Entitas ──────────────────────────────────────────
        const entitas = pick(row, 'Entitas', 'ENTITAS', 'entitas') || 'TCU'

        return {
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
          status_laporan,
        }
      })

      // Filter baris kosong (baris tanpa nama dan NPP valid)
      const valid = cleaned.filter(r => r.nama !== '-' || r.npp.startsWith('TCU_') === false)
      finalData.push(...valid)
    })

    if (finalData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada data valid di file Excel' },
        { status: 400 }
      )
    }

    // Debug: log sample pertama
    console.log('[upload-tcu-excel] sample[0]:', {
      nama: finalData[0].nama,
      pendidikan: finalData[0].pendidikan,
      jenis_kelamin: finalData[0].jenis_kelamin,
      organik_non_organik: finalData[0].organik_non_organik,
    })

    // ── 2. CONNECT DATABASE ──────────────────────────────────
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo_revisi',
      port: Number(process.env.DB_PORT) || 3307,
    })

    // ── 3. DELETE DATA LAMA ──────────────────────────────────
    await connection.execute(
      'DELETE FROM tcudata WHERE bulan = ? AND tahun = ?',
      [body.bulan, body.tahun]
    )

    // ── 4. INSERT DATA BARU ──────────────────────────────────
    for (const item of finalData) {
      await connection.execute(
        `INSERT INTO tcudata (
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
          kategori, jenis_kelamin, pendidikan, organik_non_organik,
          pusat_pelayanan, non_operasional, status_laporan,
          bulan, tahun, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        item.npp,
        item.nama,
        item.tanggal_lahir,
        item.jabatan,
        item.entitas,
        item.unit_kerja,
        item.kategori,
        item.jenis_kelamin,
        item.pendidikan,
        item.organik_non_organik,
        item.pusat_pelayanan,
        item.non_operasional,
        item.status_laporan,
        body.bulan,
        body.tahun,
      ])
    }

    await connection.end()

    // ── 5. RESPONSE ──────────────────────────────────────────
    return NextResponse.json({
      success: true,
      total: finalData.length,
      message: `Berhasil import ${finalData.length} data ke database`,
    })

  } catch (error) {
    console.error('[upload-tcu-excel] ERROR:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal proses file: ' + (error as Error).message },
      { status: 500 }
    )
  }
}