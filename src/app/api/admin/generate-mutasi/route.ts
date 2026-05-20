import { NextResponse } from "next/server";
import { processMutasi } from "@/lib/processMutasi";

export async function GET() {

  try {

    // reset mutasi lama
    const mysql = await import("mysql2/promise");

    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "spmt_pelindo_revisi",
      port: Number(process.env.DB_PORT) || 3307,
    });

    await conn.execute(`
      TRUNCATE TABLE mutasi_sdm
    `);

    await conn.end();

    // generate semua bulan
    for (let tahun = 2025; tahun <= 2026; tahun++) {

      for (let bulan = 1; bulan <= 12; bulan++) {

        console.log(
          `Generate mutasi ${bulan}-${tahun}`
        );

        await processMutasi(
          bulan,
          tahun
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Generate mutasi berhasil",
    });

  } catch (err: any) {

    console.error(err);

    return NextResponse.json({
      success: false,
      message: err.message,
    });
  }
}