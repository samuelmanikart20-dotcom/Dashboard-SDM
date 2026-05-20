import { NextResponse } from "next/server";
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

export async function GET(req: Request) {

  let conn: mysql.Connection | null = null;

  try {

    const url = new URL(req.url);

    const monthParam =
      url.searchParams.get("month");

    const year =
      url.searchParams.get("year") || "";

    const month =
      monthParam && monthParam !== "all"
        ? monthParam
        : null;

    const { where, params } =
      buildWhere(month, year);

    conn = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "spmt_pelindo_revisi",
      port: 3307,
    });

    const sql = `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN organik_non_organik LIKE '%ORGANIK%'
            THEN 1
            ELSE 0
          END
        ) AS organik,

        SUM(
          CASE
            WHEN organik_non_organik LIKE '%NON%'
            THEN 1
            ELSE 0
          END
        ) AS nonOrganik,

        SUM(
          CASE
            WHEN pusat_pelayanan LIKE '%OPERASIONAL%'
            THEN 1
            ELSE 0
          END
        ) AS operasional,

        SUM(
          CASE
            WHEN pusat_pelayanan LIKE '%NON%'
            THEN 1
            ELSE 0
          END
        ) AS nonOperasional,

        SUM(
          CASE
            WHEN jenis_kelamin LIKE 'L%'
            THEN 1
            ELSE 0
          END
        ) AS lakiLaki,

        SUM(
          CASE
            WHEN jenis_kelamin LIKE 'P%'
            THEN 1
            ELSE 0
          END
        ) AS perempuan

      FROM (

        SELECT
          organik_non_organik,
          pusat_pelayanan,
          jenis_kelamin,
          bulan,
          tahun
        FROM spmtdata

        UNION ALL

        SELECT
          organik_non_organik,
          pusat_pelayanan,
          jenis_kelamin,
          bulan,
          tahun
        FROM ptpdata

        UNION ALL

        SELECT
          organik_non_organik,
          pusat_pelayanan,
          jenis_kelamin,
          bulan,
          tahun
        FROM iktdata

        UNION ALL

        SELECT
          organik_non_organik,
          pusat_pelayanan,
          jenis_kelamin,
          bulan,
          tahun
        FROM tcudata

      ) t

      WHERE ${where}
    `;

    const [rows]: any = await conn.execute(
      sql,
      params
    );

    const result = rows[0] || {};

    return NextResponse.json({
      success: true,

      data: {
        totalEmployees:
          result.total || 0,

        chartData: {

          organik:
            result.organik || 0,

          nonOrganik:
            result.nonOrganik || 0,

          operasional:
            result.operasional || 0,

          nonOperasional:
            result.nonOperasional || 0,

          lakiLaki:
            result.lakiLaki || 0,

          perempuan:
            result.perempuan || 0,

          total:
            result.total || 0,
        },
      },
    });

  } catch (error: any) {

    console.error(
      "COMBINED DASHBOARD ERROR:",
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