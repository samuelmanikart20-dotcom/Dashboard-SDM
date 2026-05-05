import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getRegionFromUnitKerja } from '@/lib/unit-kerja-region-mapping';

// ---------------------------------------------------------------
// Helper: normalisasi nilai organik_non_organik dari DB
// Nilai di DB: 'ORGANIK', 'Organik (SPMT)', 'NON ORGANIK',
//              'Non Organik (SPMT)', 'BOD ORGANIK & NON ORGANIK PELINDO (SPMT)'
// ---------------------------------------------------------------
function normalizeOrganik(raw: string): 'organik' | 'non-organik' | 'skip' {
  const s = (raw || '').toUpperCase().trim();
  if (!s) return 'skip';
  // BOD campur → skip (tidak masuk ke salah satu bucket)
  if (s.includes('BOD')) return 'skip';
  // Cek NON dulu agar "NON ORGANIK" tidak salah masuk Organik
  if (s.includes('NON')) return 'non-organik';
  if (s.includes('ORGANIK')) return 'organik';
  return 'skip';
}

// Helper: normalisasi nilai non_operasional dari DB
// Nilai di DB: 'OPERASIONAL', 'NON OPERASIONAL', '' / NULL
function normalizeOperasional(
  nonOpCol: string,
  pusatPelayananCol: string
): 'operasional' | 'non-operasional' | null {
  const nonOp = (nonOpCol || '').toUpperCase().trim();
  const pusat = (pusatPelayananCol || '').toUpperCase().trim();

  // Prioritas: kolom non_operasional
  if (nonOp === 'OPERASIONAL') return 'operasional';
  if (nonOp.includes('NON')) return 'non-operasional';

  // Fallback: kolom pusat_pelayanan
  if (pusat.includes('NON')) return 'non-operasional';
  if (
    pusat.includes('OPERASI LANGSUNG') ||
    pusat.includes('OPERASI TIDAK LANGSUNG') ||
    pusat.includes('OPERASI')
  )
    return 'operasional';
  if (pusat.includes('PENGELOLAAN') || pusat.includes('PENDUKUNG'))
    return 'non-operasional';

  return null;
}

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const daerahId = searchParams.get('daerah_id');

    // Build base WHERE clause
    let whereClause = '';
    const queryParams: any[] = [];

    if (month && year && month !== 'all' && year !== 'all') {
      whereClause = 'WHERE bulan = ? AND tahun = ?';
      queryParams.push(parseInt(month), parseInt(year));
    } else if (month && month !== 'all') {
      whereClause = 'WHERE bulan = ?';
      queryParams.push(parseInt(month));
    } else if (year && year !== 'all') {
      whereClause = 'WHERE tahun = ?';
      queryParams.push(parseInt(year));
    }

    // ---------------------------------------------------------------
    // MODE: Filter per daerah
    // ---------------------------------------------------------------
    if (daerahId) {
      const connection = await mysql.createConnection(dbConfig);

      const [daerahResult] = await connection.execute(
        'SELECT nama, kode FROM daerah WHERE id = ?',
        [parseInt(daerahId)]
      );

      if ((daerahResult as any[]).length > 0) {
        const daerahInfo = (daerahResult as any[])[0];

        let unitKerjaFilter = '';
        switch (daerahInfo.kode) {
          case 'BBLW': unitKerjaFilter = 'BELAWAN'; break;
          case 'BTJW': unitKerjaFilter = 'TANJUNG WANGI'; break;
          case 'BDMI': unitKerjaFilter = 'DUMAI'; break;
          case 'BTJI': unitKerjaFilter = 'TANJUNG INTAN'; break;
          case 'BBHG': unitKerjaFilter = 'BUMIHARJO'; break;
          case 'BMKS': unitKerjaFilter = 'MAKASSAR'; break;
          case 'BBLP': unitKerjaFilter = 'BALIKPAPAN'; break;
          case 'BJMR': unitKerjaFilter = 'JAMRUD NILAM'; break;
          case 'BTRI': unitKerjaFilter = 'TRISAKTI'; break;
          case 'BPRE': unitKerjaFilter = 'PARE-PARE'; break;
          case 'BTJE': unitKerjaFilter = 'TANJUNG EMAS'; break;
          case 'BLMB': unitKerjaFilter = 'LEMBAR'; break;
          case 'BGRS': unitKerjaFilter = 'GRESIK'; break;
          case 'BMLH': unitKerjaFilter = 'MALAHAYATI'; break;
          case 'BLHW': unitKerjaFilter = 'LHOKSEUMAWE'; break;
          case 'BNOA': unitKerjaFilter = 'BENOA'; break;
          case 'BSBG': unitKerjaFilter = 'SIBOLGA'; break;
          case 'BTBK': unitKerjaFilter = 'TANJUNG BALAI'; break;
          case 'BTPI': unitKerjaFilter = 'TANJUNG PINANG'; break;
          case 'BBMB': unitKerjaFilter = 'BIMA BADAS'; break;
          case 'KP':   unitKerjaFilter = 'KANTOR PUSAT'; break;
          default: unitKerjaFilter = daerahInfo.nama.toUpperCase(); break;
        }

        const filteredQuery = `
          SELECT jenis_kelamin, organik_non_organik, pusat_pelayanan, non_operasional
          FROM spmtdata
          ${whereClause ? whereClause + ' AND' : 'WHERE'}
          (unit_kerja LIKE ? OR unit_kerja LIKE ? OR entitas LIKE ?)
        `;
        const filterParams = [
          ...queryParams,
          `%${unitKerjaFilter}%`,
          `%SPMT-${unitKerjaFilter}%`,
          `%${unitKerjaFilter}%`,
        ];

        const [filteredData] = await connection.execute(filteredQuery, filterParams);

        let lakiLaki = 0, perempuan = 0;
        let organik = 0, nonOrganik = 0;
        let operasional = 0, nonOperasional = 0;
        let organikOperasional = 0, organikNonOperasional = 0;
        let nonOrganikOperasional = 0, nonOrganikNonOperasional = 0;

        (filteredData as any[]).forEach((row) => {
          // Gender
          const gender = (row.jenis_kelamin || '').toUpperCase().trim();
          if (gender === 'L' || gender === 'LAKI-LAKI' || gender === 'LAKI LAKI') lakiLaki++;
          else if (gender === 'P' || gender === 'PEREMPUAN') perempuan++;

          // Organik — pakai helper agar semua variasi tertangkap
          const orgStatus = normalizeOrganik(row.organik_non_organik || '');
          if (orgStatus === 'organik') organik++;
          else if (orgStatus === 'non-organik') nonOrganik++;

          // Operasional
          const opStatus = normalizeOperasional(
            row.non_operasional || '',
            row.pusat_pelayanan || ''
          );
          if (opStatus === 'operasional') operasional++;
          else if (opStatus === 'non-operasional') nonOperasional++;

          // Combined
          const isOrg = orgStatus === 'organik';
          const isNonOrg = orgStatus === 'non-organik';
          const isOp = opStatus === 'operasional';
          const isNonOp = opStatus === 'non-operasional';

          if (isOrg && isOp) organikOperasional++;
          if (isOrg && isNonOp) organikNonOperasional++;
          if (isNonOrg && isOp) nonOrganikOperasional++;
          if (isNonOrg && isNonOp) nonOrganikNonOperasional++;
        });

        const total = (filteredData as any[]).length;
        await connection.end();

        return NextResponse.json({
          success: true,
          data: {
            totalEmployees: total,
            region: daerahInfo,
            chartData: {
              lakiLaki,
              perempuan,
              organik,
              nonOrganik,
              operasional,
              nonOperasional,
              organikOperasional,
              organikNonOperasional,
              nonOrganikOperasional,
              nonOrganikNonOperasional,
              total,
            },
          },
        });
      }

      await connection.end();
    }

    // ---------------------------------------------------------------
    // MODE: Konsolidasi semua daerah (StandAlone / daerah_id tidak ada)
    // ---------------------------------------------------------------
    const connection = await mysql.createConnection(dbConfig);

    try {
      // Total
      const [totalResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM spmtdata ${whereClause}`,
        queryParams
      );
      const total = (totalResult as any[])[0]?.total || 0;

      // Gender
      const [genderResult] = await connection.execute(
        `SELECT jenis_kelamin, COUNT(*) as count
         FROM spmtdata ${whereClause}
         GROUP BY jenis_kelamin`,
        queryParams
      );

      // Organik
      const [organikResult] = await connection.execute(
        `SELECT organik_non_organik, COUNT(*) as count
         FROM spmtdata ${whereClause}
         GROUP BY organik_non_organik`,
        queryParams
      );

      // Operasional (kombinasi kedua kolom)
      const [operasionalResult] = await connection.execute(
        `SELECT pusat_pelayanan, non_operasional, COUNT(*) as count
         FROM spmtdata ${whereClause}
         GROUP BY pusat_pelayanan, non_operasional`,
        queryParams
      );

      // Combined breakdown
      const [combinedResult] = await connection.execute(
        `SELECT organik_non_organik, pusat_pelayanan, non_operasional, COUNT(*) as count
         FROM spmtdata ${whereClause}
         GROUP BY organik_non_organik, pusat_pelayanan, non_operasional`,
        queryParams
      );

      let lakiLaki = 0, perempuan = 0;
      let organik = 0, nonOrganik = 0;
      let operasional = 0, nonOperasional = 0;
      let organikOperasional = 0, organikNonOperasional = 0;
      let nonOrganikOperasional = 0, nonOrganikNonOperasional = 0;

      // ---- Gender ----
      (genderResult as any[]).forEach((row) => {
        const gender = (row.jenis_kelamin || '').toUpperCase().trim();
        if (gender === 'L' || gender === 'LAKI-LAKI' || gender === 'LAKI LAKI') {
          lakiLaki += row.count;
        } else if (gender === 'P' || gender === 'PEREMPUAN') {
          perempuan += row.count;
        }
      });

      // ---- Organik ----
      // FIX: pakai helper normalizeOrganik agar semua variasi tertangkap:
      // 'ORGANIK', 'Organik (SPMT)', 'NON ORGANIK', 'Non Organik (SPMT)',
      // 'BOD ORGANIK & NON ORGANIK PELINDO (SPMT)' → skip
      (organikResult as any[]).forEach((row) => {
        const status = normalizeOrganik(row.organik_non_organik || '');
        if (status === 'organik') organik += row.count;
        else if (status === 'non-organik') nonOrganik += row.count;
        // 'skip' → tidak dihitung ke mana-mana
      });

      // ---- Operasional ----
      (operasionalResult as any[]).forEach((row) => {
        const status = normalizeOperasional(
          row.non_operasional || '',
          row.pusat_pelayanan || ''
        );
        if (status === 'operasional') operasional += row.count;
        else if (status === 'non-operasional') nonOperasional += row.count;
      });

      // ---- Combined ----
      (combinedResult as any[]).forEach((row) => {
        const orgStatus = normalizeOrganik(row.organik_non_organik || '');
        const opStatus = normalizeOperasional(
          row.non_operasional || '',
          row.pusat_pelayanan || ''
        );

        const isOrg = orgStatus === 'organik';
        const isNonOrg = orgStatus === 'non-organik';
        const isOp = opStatus === 'operasional';
        const isNonOp = opStatus === 'non-operasional';

        if (isOrg && isOp) organikOperasional += row.count;
        else if (isOrg && isNonOp) organikNonOperasional += row.count;
        else if (isNonOrg && isOp) nonOrganikOperasional += row.count;
        else if (isNonOrg && isNonOp) nonOrganikNonOperasional += row.count;
      });

      await connection.end();

      return NextResponse.json({
        success: true,
        data: {
          total,
          chartData: {
            organik,
            nonOrganik,
            operasional,
            nonOperasional,
            lakiLaki,
            perempuan,
            organikOperasional,
            organikNonOperasional,
            nonOrganikOperasional,
            nonOrganikNonOperasional,
            total,
          },
        },
      });
    } catch (dbError) {
      await connection.end();
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}