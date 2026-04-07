export const runtime = 'nodejs'

import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import mysql from "mysql2/promise"

// 🔥 helper normalisasi
const normalize = (val: any) => val?.toString().trim() || null

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const buffer = Buffer.from(body.file)

    const workbook = XLSX.read(buffer, { type: "buffer" })

    let finalData: any[] = []

    // ===============================
    // 1. BACA SEMUA SHEET
    // ===============================
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet)

      const cleaned = data.map((row: any) => {
        // 🔥 NORMALISASI SEMUA FIELD
        const jk = normalize(row["JENIS KELAMIN"])?.toLowerCase()
        const pekerja = normalize(row["JENIS PEKERJA (ORGANIK/NON ORGANIK)"])?.toLowerCase()
        const pelayanan = normalize(row["PUSAT PELAYANAN OPERASIONAL/NON OPERASIONAL"])?.toLowerCase()

        return {
          npp: normalize(row["NPP"]) || `TCU_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          nama: normalize(row["NAMA"]) || normalize(row["Nama"]) || "-",
          tanggal_lahir: normalize(row["TANGGAL LAHIR"]),
          jabatan: normalize(row["NAMA JABATAN"]) || normalize(row["Jabatan"]) || "-",
          entitas: normalize(row["ENTITAS"]) || "TCU",
          unit_kerja: normalize(row["UNIT KERJA"]) || "-",
          kategori: normalize(row["KATEGORI"]) || "-",

          // 🔥 FIX UTAMA (BIAR DASHBOARD HIDUP)
          jenis_kelamin:
            jk === "laki-laki" ? "Laki-laki" :
            jk === "perempuan" ? "Perempuan" : "-",

          organik_non_organik:
            pekerja === "organik" ? "Organik" :
            pekerja === "non organik" ? "Non Organik" : "-",

          pusat_pelayanan:
            pelayanan?.includes("operasional") ? "Operasional" : "Non Operasional",

          pendidikan: normalize(row["PENDIDIKAN"]),
          non_operasional: normalize(row["NON OPERASIONAL"]),
          status_laporan: normalize(row["STATUS LAPORAN RAKOMDIR"]) || "-"
        }
      })

      finalData.push(...cleaned)
    })

    // ===============================
    // 2. CONNECT DATABASE
    // ===============================
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "spmt_pelindo_revisi",
      port: Number(process.env.DB_PORT) || 3307
    })

    // ===============================
    // 3. DELETE DATA LAMA
    // ===============================
    await connection.execute(
      "DELETE FROM tcudata WHERE bulan = ? AND tahun = ?",
      [body.bulan, body.tahun]
    )

    // ===============================
    // 4. INSERT DATA BARU
    // ===============================
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
          body.tahun
        ]
      )
    }

    await connection.end()

    // ===============================
    // 5. RESPONSE
    // ===============================
    return NextResponse.json({
      success: true,
      total: finalData.length,
      message: "Data berhasil diproses & masuk database"
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { success: false, message: "Gagal proses file" },
      { status: 500 }
    )
  }
}