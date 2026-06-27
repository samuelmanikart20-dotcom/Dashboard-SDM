import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prismaClient.sdm_data.groupBy({
      by: ["tahun", "bulan"],
      _sum: {
        jumlah: true,
      },
      orderBy: [
        { tahun: "asc" },
        { bulan: "asc" }
      ],
    });

    const result = data.map((item, index) => {
      let growth = 0;

      if (index > 0) {
        const prev = data[index - 1]._sum.jumlah || 0;
        const current = item._sum.jumlah || 0;

        if (prev !== 0) {
          growth = ((current - prev) / prev) * 100;
        }
      }

      return {
        tahun: item.tahun,
        bulan: item.bulan,
        total: item._sum.jumlah || 0,
        growth: Number(growth.toFixed(2)),
      };
    });

    const latest = result[result.length - 1];

    const insight =
      latest?.growth > 0
        ? `SDM naik ${latest.growth}% dibanding bulan sebelumnya`
        : `SDM turun ${Math.abs(latest?.growth || 0)}% dibanding bulan sebelumnya`;

    return NextResponse.json({
      data: result,
      insight,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}