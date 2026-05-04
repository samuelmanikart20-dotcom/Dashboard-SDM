// ============================================================
// FILE: src/app/api/admin/tcu-dashboard-stats/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'spmt_pelindo_revisi',
  port:     Number(process.env.DB_PORT) || 3307,
};

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const bulan     = searchParams.get('bulan');
    const tahun     = searchParams.get('tahun');
    const unitKerja = searchParams.get('unit_kerja');

    if (!bulan || !tahun) {
      return NextResponse.json(
        { message: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // ── Build WHERE clause ───────────────────────────────────
    let whereClause = '';
    const params: any[] = [];

    if (bulan === 'all') {
      whereClause = 'WHERE tahun = ?';
      params.push(parseInt(tahun));
    } else {
      const bulanInt = parseInt(bulan);
      const tahunInt = parseInt(tahun);

      if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
        return NextResponse.json(
          { message: 'Bulan tidak valid (harus 1-12 atau "all")' },
          { status: 400 }
        );
      }
      if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
        return NextResponse.json(
          { message: 'Tahun tidak valid' },
          { status: 400 }
        );
      }

      console.log('[tcu-dashboard-stats] Filter:', { bulan: bulanInt, tahun: tahunInt });
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
    }

    // ── Unit kerja filter ────────────────────────────────────
    if (unitKerja && unitKerja !== 'all') {
      if (unitKerja === 'TCU-KP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%');
      } else if (unitKerja === 'TCU-SMP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%MEKAR PUTIH%', '%Mekar Putih%');
      }
    }

    // ── 1. Total karyawan ────────────────────────────────────
    const [totalResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM tcudata ${whereClause}`,
      params
    );
    const totalEmployees = (totalResult as any)[0].total;

    // ── 2. Organik vs Non Organik ────────────────────────────
    const [organikResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN organik_non_organik LIKE '%Non Organik%'
            OR organik_non_organik LIKE '%NON ORGANIK%'
            OR organik_non_organik LIKE '%NON-ORGANIK%' THEN 'Non Organik'
          WHEN organik_non_organik LIKE '%Organik%'
            OR organik_non_organik LIKE '%ORGANIK%' THEN 'Organik'
          ELSE 'Unknown'
        END as organik_category,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY organik_category`,
      params
    );

    // ── 3. Operasional vs Non Operasional ────────────────────
    const [operasionalResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN non_operasional = 'OPERASIONAL'
            OR pusat_pelayanan LIKE '%OPERASI LANGSUNG%' THEN 'OPERASIONAL'
          WHEN non_operasional = 'NON OPERASIONAL'
            OR pusat_pelayanan LIKE '%PENDUKUNG OPERASI%' THEN 'NON OPERASIONAL'
          ELSE 'LAINNYA'
        END as operational_status,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY operational_status`,
      params
    );

    // ── 4. Gender ────────────────────────────────────────────
    const [genderResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN jenis_kelamin = 'L' OR jenis_kelamin LIKE '%Laki%' THEN 'Laki-laki'
          WHEN jenis_kelamin = 'P' OR jenis_kelamin LIKE '%Perempuan%' THEN 'Perempuan'
          ELSE jenis_kelamin
        END as gender_category,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY gender_category`,
      params
    );

    // ── 5. ✅ PENDIDIKAN — normalisasi nilai agar konsisten ──
    // Masalah: nilai di DB bisa "S1", "s1", " S1 ", "Sarjana", dll
    // Solusi: TRIM + UPPER + CASE mapping ke kategori standar
    const [pendidikanResult] = await connection.execute(
      `SELECT 
        CASE
          WHEN UPPER(TRIM(pendidikan)) IN ('S3', 'DOKTOR', 'DOKTORAL') THEN 'S3'
          WHEN UPPER(TRIM(pendidikan)) IN ('S2', 'MAGISTER', 'MASTER')  THEN 'S2'
          WHEN UPPER(TRIM(pendidikan)) IN ('S1', 'SARJANA')             THEN 'S1'
          WHEN UPPER(TRIM(pendidikan)) IN ('D4')                        THEN 'D4'
          WHEN UPPER(TRIM(pendidikan)) IN ('D3', 'DIPLOMA', 'DIPLOMA 3') THEN 'Diploma'
          WHEN UPPER(TRIM(pendidikan)) IN ('D2', 'DIPLOMA 2')           THEN 'Diploma'
          WHEN UPPER(TRIM(pendidikan)) IN ('D1', 'DIPLOMA 1')           THEN 'Diploma'
          WHEN UPPER(TRIM(pendidikan)) LIKE '%SMA%'
            OR UPPER(TRIM(pendidikan)) LIKE '%SMK%'
            OR UPPER(TRIM(pendidikan)) LIKE '%SLTA%'                    THEN 'SMA'
          WHEN UPPER(TRIM(pendidikan)) LIKE '%SMP%'
            OR UPPER(TRIM(pendidikan)) LIKE '%SLTP%'                    THEN 'SMP'
          WHEN UPPER(TRIM(pendidikan)) LIKE '%SD%'                      THEN 'SD'
          WHEN pendidikan IS NULL
            OR TRIM(pendidikan) = ''
            OR TRIM(pendidikan) = '-'                                   THEN 'Tidak Diketahui'
          ELSE TRIM(pendidikan)
        END as pendidikan_category,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY pendidikan_category
       ORDER BY FIELD(
         pendidikan_category,
         'S3','S2','S1','D4','Diploma','SMA','SMP','SD','Tidak Diketahui'
       ), pendidikan_category ASC`,
      params
    );

    console.log('[tcu-dashboard-stats] pendidikan raw:', pendidikanResult);

    // ── 6. Detail (organik + operasional) ───────────────────
    const [detailedResult] = await connection.execute(
      `SELECT 
        CASE 
          WHEN organik_non_organik LIKE '%Non Organik%'
            OR organik_non_organik LIKE '%NON ORGANIK%' THEN 'Non Organik'
          WHEN organik_non_organik LIKE '%Organik%'
            OR organik_non_organik LIKE '%ORGANIK%' THEN 'Organik'
          ELSE 'Unknown'
        END as organik_category,
        CASE 
          WHEN non_operasional = 'OPERASIONAL'
            OR pusat_pelayanan LIKE '%OPERASI LANGSUNG%' THEN 'OPERASIONAL'
          WHEN non_operasional = 'NON OPERASIONAL'
            OR pusat_pelayanan LIKE '%PENDUKUNG OPERASI%' THEN 'NON OPERASIONAL'
          ELSE 'LAINNYA'
        END as operational_status,
        COUNT(*) as count
       FROM tcudata ${whereClause}
       GROUP BY organik_category, operational_status`,
      params
    );

    await connection.end();

    // ── Process: Organik ─────────────────────────────────────
    const organikData = (organikResult as any[]).reduce(
      (acc, row) => {
        if (row.organik_category === 'Organik')     acc.organik    = Number(row.count);
        if (row.organik_category === 'Non Organik') acc.nonOrganik = Number(row.count);
        return acc;
      },
      { organik: 0, nonOrganik: 0 }
    );

    // ── Process: Operasional ─────────────────────────────────
    const operasionalData = (operasionalResult as any[]).reduce(
      (acc, row) => {
        if (row.operational_status === 'OPERASIONAL')     acc.operasional    = Number(row.count);
        if (row.operational_status === 'NON OPERASIONAL') acc.nonOperasional = Number(row.count);
        return acc;
      },
      { operasional: 0, nonOperasional: 0 }
    );

    // ── Process: Gender ──────────────────────────────────────
    const genderData = (genderResult as any[]).reduce(
      (acc, row) => {
        if (row.gender_category === 'Laki-laki') acc.lakiLaki  = Number(row.count);
        if (row.gender_category === 'Perempuan') acc.perempuan = Number(row.count);
        return acc;
      },
      { lakiLaki: 0, perempuan: 0 }
    );

    // ── Process: Pendidikan ──────────────────────────────────
    // Format array: untuk chart bar/pie
    const pendidikanArray = (pendidikanResult as any[]).map(row => ({
      label: row.pendidikan_category,
      value: Number(row.count),
    }));

    // Format object: untuk akses per key (S1, S2, SMA, dll)
    // Ini yang dipakai legend dashboard (S3: 0 org, S2: 0 org, dst)
    const pendidikanObject: Record<string, number> = {
      S3:              0,
      S2:              0,
      S1:              0,
      D4:              0,
      Diploma:         0,
      SMA:             0,
      SMP:             0,
      SD:              0,
      'Tidak Diketahui': 0,
    };
    (pendidikanResult as any[]).forEach(row => {
      const key = row.pendidikan_category as string;
      pendidikanObject[key] = Number(row.count);
    });

    console.log('[tcu-dashboard-stats] pendidikanObject:', pendidikanObject);
    console.log('[tcu-dashboard-stats] pendidikanArray:', pendidikanArray);

    // ── Process: Detail ──────────────────────────────────────
    const detailedData = (detailedResult as any[]).reduce(
      (acc, row) => {
        const isOrganik        = row.organik_category   === 'Organik';
        const isOperasional    = row.operational_status === 'OPERASIONAL';
        const isNonOperasional = row.operational_status === 'NON OPERASIONAL';

        if (isOrganik  && isOperasional)    acc.organikOperasional       = Number(row.count);
        if (isOrganik  && isNonOperasional) acc.organikNonOperasional    = Number(row.count);
        if (!isOrganik && isOperasional)    acc.nonOrganikOperasional    = Number(row.count);
        if (!isOrganik && isNonOperasional) acc.nonOrganikNonOperasional = Number(row.count);
        return acc;
      },
      {
        organikOperasional:       0,
        organikNonOperasional:    0,
        nonOrganikOperasional:    0,
        nonOrganikNonOperasional: 0,
      }
    );

    // ── Response ─────────────────────────────────────────────
    const chartData = {
      ...organikData,
      ...operasionalData,
      ...genderData,
      ...detailedData,
      total: Number(totalEmployees),

      // ✅ pendidikan — dua format agar kompatibel dengan frontend apapun
      pendidikan:      pendidikanObject,  // { S1: 10, S2: 3, SMA: 5, ... }
      pendidikanChart: pendidikanArray,   // [{ label: 'S1', value: 10 }, ...]
    };

    return NextResponse.json({
      totalEmployees: Number(totalEmployees),
      chartData,
    });

  } catch (error) {
    console.error('[tcu-dashboard-stats] ERROR:', error);
    return NextResponse.json(
      { message: 'Error fetching dashboard statistics: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try { await connection.end(); } catch {}
    }
  }
}
