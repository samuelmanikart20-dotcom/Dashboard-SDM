import mysql from "mysql2/promise";

export async function processMutasi(
  currentMonth: number,
  currentYear: number
) {

  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "spmt_pelindo_revisi",
    port: 3307,
  });

  // bulan sebelumnya
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  // ambil semua data bulan sekarang
  const [currentRows]: any = await conn.execute(`
    SELECT
      nipp,
      nama_pegawai,
      branch,
      'SPMT' as entitas,
      bulan,
      tahun
    FROM spmtdata
    WHERE bulan = ${currentMonth}
    AND tahun = ${currentYear}

    UNION ALL

    SELECT
      nipp,
      nama_pegawai,
      branch,
      'PTP' as entitas,
      bulan,
      tahun
    FROM ptpdata
    WHERE bulan = ${currentMonth}
    AND tahun = ${currentYear}
  `);

  // ambil data bulan sebelumnya
  const [prevRows]: any = await conn.execute(`
    SELECT
      nipp,
      nama_pegawai,
      branch,
      'SPMT' as entitas
    FROM spmtdata
    WHERE bulan = ${prevMonth}
    AND tahun = ${prevYear}

    UNION ALL

    SELECT
      nipp,
      nama_pegawai,
      branch,
      'PTP' as entitas
    FROM ptpdata
    WHERE bulan = ${prevMonth}
    AND tahun = ${prevYear}
  `);

  // map previous
  const prevMap = new Map();

  prevRows.forEach((item: any) => {
    prevMap.set(item.nipp, item);
  });

  // cek perubahan
  for (const current of currentRows) {

    const prev = prevMap.get(current.nipp);

    // pegawai baru
    if (!prev) {

      await conn.execute(`
        INSERT INTO mutasi_sdm (
          nipp,
          nama,
          entitas_asal,
          entitas_tujuan,
          branch_asal,
          branch_tujuan,
          jenis_mutasi,
          tanggal_mutasi,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        current.nipp,
        current.nama_pegawai,
        '-',
        current.entitas,
        '-',
        current.branch,
        'Rekrut',
        'Pegawai baru'
      ]);

      continue;
    }

    // pindah entitas / branch
    if (
      prev.entitas !== current.entitas ||
      prev.branch !== current.branch
    ) {

      await conn.execute(`
        INSERT INTO mutasi_sdm (
          nipp,
          nama,
          entitas_asal,
          entitas_tujuan,
          branch_asal,
          branch_tujuan,
          jenis_mutasi,
          tanggal_mutasi,
          keterangan
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        current.nipp,
        current.nama_pegawai,
        prev.entitas,
        current.entitas,
        prev.branch,
        current.branch,
        'Mutasi',
        'Perpindahan pegawai'
      ]);
    }
  }

  await conn.end();
}