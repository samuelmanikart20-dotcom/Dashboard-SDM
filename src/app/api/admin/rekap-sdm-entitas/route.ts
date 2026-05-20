import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

function buildWhere(month?: string | null, year?: string) {
  const params: number[] = [];

  if (year && month) {
    const bulan = parseInt(month);
    const tahun = parseInt(year);

    return {
      where: "bulan = ? AND tahun = ?",
      params: [bulan, tahun],
    };
  }

  return {
    where: "1=1",
    params: [],
  };
}

export async function GET(request: NextRequest) {
  let conn: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);

    const bulan = searchParams.get("bulan");
    const tahun = searchParams.get("tahun");
    const entitas = searchParams.get("entitas");

    if (!bulan || !tahun || !entitas) {
      return NextResponse.json(
        {
          success: false,
          message: "Parameter tidak lengkap",
        },
        { status: 400 }
      );
    }

    const { where, params } = buildWhere(
      bulan,
      tahun
    );

    conn = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "spmt_pelindo_revisi",
      port: 3307,
    });

    let tableName = "";

    switch (entitas.toUpperCase()) {
      case "SPMT":
        tableName = "spmtdata";
        break;

      case "PTP":
        tableName = "ptpdata";
        break;

      case "IKT":
        tableName = "iktdata";
        break;

      case "TCU":
        tableName = "tcudata";
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            message: "Entitas tidak valid",
          },
          { status: 400 }
        );
    }

    const sql = `
      SELECT
        organik_non_organik,
        COUNT(*) as total
      FROM ${tableName}
      WHERE ${where}
      GROUP BY organik_non_organik
    `;

    const [rows]: any = await conn.execute(
      sql,
      params
    );

    const result = rows || [];

    const mappedData = result.map((item: any) => ({
      status:
        item.organik_non_organik || "Lainnya",

      satuan: "orang",

      rkap: null,

      realisasi: item.total || 0,

      selisih: null,

      capaian: null,
    }));

    const total = mappedData.reduce(
      (sum: number, item: any) =>
        sum + item.realisasi,
      0
    );

    mappedData.push({
      status: "Jumlah",
      satuan: "orang",
      rkap: null,
      realisasi: total,
      selisih: null,
      capaian: null,
    });

    return NextResponse.json({
      success: true,
      data: mappedData,
    });

  } catch (error: any) {
    console.error(
      "ERROR REKAP ENTITAS:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Server Error",
      },
      { status: 500 }
    );

  } finally {
    if (conn) {
      await conn.end();
    }
  }
}