export const runtime = 'nodejs'

import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import mysql from "mysql2/promise"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const buffer = Buffer.from(body.file)

    const workbook = XLSX.read(buffer, { type: "buffer" })

    let finalData: any[] = []

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]

      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
      })

      console.log("TOTAL ROW:", raw.length)

      // ===============================
      // 🔥 DETEKSI HEADER FLEXIBLE
      // ===============================
      let headerIndex = -1

      for (let i = 0; i < raw.length; i++) {
        const row = raw[i].join(" ").toLowerCase()

        if (
          row.includes("nip") &&
          row.includes("nama")
        ) {
          headerIndex = i
          break
        }
      }

      if (headerIndex === -1) {
        console.log("❌ HEADER TIDAK DITEMUKAN")
        return
      }

      const headers = raw[headerIndex]

      console.log("HEADER FOUND:", headers)

      // ===============================
      // 🔥 MAPPING DINAMIS
      // ===============================
      const findIndex = (keyword: string) =>
        headers.findIndex(h =>
          h?.toString().toLowerCase().includes(keyword)
        )

      const idx = {
        npp: findIndex("nip"),
        nama: findIndex("nama"),
        jabatan: findIndex("jabatan"),
        unit: findIndex("unit"),
        bidang: findIndex("bidang"),
        gender: findIndex("kelamin"),
        tanggal: findIndex("tanggal"),
        pendidikan: findIndex("pendidikan")
      }

      console.log("MAPPING:", idx)

      // ===============================
      // 🔥 LOOP DATA
      // ===============================
      for (let i = headerIndex + 1; i < raw.length; i++) {
        const row = raw[i]

        const nama = row[idx.nama]
        if (!nama) continue

        const npp = row[idx.npp]
        const jabatan = row[idx.jabatan]
        const unit = row[idx.unit]
        const bidang = row[idx.bidang]
        const gender = row[idx.gender]
        const pendidikan = row[idx.pendidikan]

        // ===============================
        // 🔥 KATEGORI ORGANIK
        // ===============================
        let kategori = "Non Organik"
        if (npp && npp.toString().length === 6) {
          kategori = "Organik"
        }

        // ===============================
        // 🔥 OPERASIONAL
        // ===============================
        let pusat = ""
        const b = (bidang || "").toString().toUpperCase()

        if (
          b.includes("OPERASI LANGSUNG") ||
          b.includes("OPERASI TIDAK LANGSUNG")
        ) pusat = "Operasional"

        else if (
          b.includes("PENDUKUNG OPERASI") ||
          b.includes("PENGELOLAAN")
        ) pusat = "Non Operasional"

        finalData.push({
          npp: npp || `${nama}_${i}`,
          nama,
          jabatan: jabatan || "-",
          unit_kerja: unit || "-",
          jenis_kelamin:
            gender === "Male" ? "Laki-laki" : "Perempuan",
          organik_non_organik: kategori,
          pusat_pelayanan: pusat,
          pendidikan: pendidikan || "-"
        })
      }
    })

    console.log("FINAL:", finalData.length)

    if (finalData.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Data kosong setelah parsing"
      })
    }

    // ===============================
    // DB
    // ===============================
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "spmt_pelindo_revisi",
      port: Number(process.env.DB_PORT) || 3307
    })

    const tableMap: any = {
      TCU: "tcudata",
      PTP: "ptpdata",
      SPMT: "spmtdata",
      IKT: "iktdata"
    }

    const table = tableMap[body.type]

    await conn.execute(
      `DELETE FROM ${table} WHERE bulan=? AND tahun=?`,
      [body.bulan, body.tahun]
    )

    for (const item of finalData) {
      await conn.execute(
        `INSERT INTO ${table}
        (npp,nama,jabatan,unit_kerja,jenis_kelamin,
         organik_non_organik,pusat_pelayanan,
         pendidikan,bulan,tahun)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          item.npp,
          item.nama,
          item.jabatan,
          item.unit_kerja,
          item.jenis_kelamin,
          item.organik_non_organik,
          item.pusat_pelayanan,
          item.pendidikan,
          body.bulan,
          body.tahun
        ]
      )
    }

    await conn.end()

    return NextResponse.json({
      success: true,
      total: finalData.length
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { success: false, message: "Gagal proses file" },
      { status: 500 }
    )
  }
}