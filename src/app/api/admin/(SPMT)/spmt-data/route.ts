import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bulanParam = searchParams.get('bulan');
    const tahunParam = searchParams.get('tahun');

    let selectedMonths: number[] = [];
    let selectedYear: number | undefined = undefined;

    if (bulanParam) {
      if (bulanParam.includes(',')) {
        selectedMonths = bulanParam
          .split(',')
          .map((m) => parseInt(m.trim()))
          .filter((m) => !isNaN(m));
      } else {
        const month = parseInt(bulanParam);
        if (!isNaN(month)) selectedMonths = [month];
      }
    }

    if (tahunParam) {
      const year = parseInt(tahunParam);
      if (!isNaN(year)) selectedYear = year;
    }

    const connection = await mysql.createConnection(dbConfig);
    try {
      const [tables] = await connection.execute("SHOW TABLES LIKE 'spmtdata'");
      if ((tables as any[]).length === 0) {
        return NextResponse.json({
          chartData: [],
          summary: { totalPekerja: 0, bopo: 0, rasio: 0, produktivitas: 0 },
        });
      }

      let whereClause = '';
      let params: any[] = [];

      if (selectedMonths.length > 0 && selectedYear !== undefined) {
        const placeholders = selectedMonths.map(() => '?').join(',');
        whereClause = `WHERE bulan IN (${placeholders}) AND tahun = ?`;
        params = [...selectedMonths, selectedYear];
      } else if (selectedYear !== undefined) {
        whereClause = 'WHERE tahun = ?';
        params = [selectedYear];
      }

      const [rows] = await connection.execute(
        `SELECT * FROM spmtdata ${whereClause}`,
        params
      );
      const raw = rows as any[];

      if (raw.length === 0) {
        return NextResponse.json({
          chartData: [],
          summary: { totalPekerja: 0, bopo: 0, rasio: 0, produktivitas: 0 },
        });
      }

      // ---------------------------------------------------------------
      // readField: cari nilai dari banyak kemungkinan nama kolom.
      // Pencocokan dilakukan case-insensitive dan ignore spasi/underscore
      // agar tidak gagal karena perbedaan kapitalisasi atau separator.
      // ---------------------------------------------------------------
      const readField = (row: any, keys: string[]): string => {
        // Buat map key yang dinormalisasi -> nama kolom asli
        const rowKeys = Object.keys(row);
        const normalize = (k: string) =>
          k.toLowerCase().replace(/[\s_\-]+/g, '');

        for (const targetKey of keys) {
          const normalizedTarget = normalize(targetKey);
          const matchedKey = rowKeys.find(
            (rk) => normalize(rk) === normalizedTarget
          );
          if (
            matchedKey !== undefined &&
            row[matchedKey] !== null &&
            row[matchedKey] !== undefined &&
            String(row[matchedKey]).trim() !== ''
          ) {
            return String(row[matchedKey]).trim();
          }
        }
        return '';
      };

      // ---------------------------------------------------------------
      // Normalisasi nilai — pakai trim + toLowerCase agar tahan spasi
      // dan variasi huruf besar/kecil dari Excel upload.
      // ---------------------------------------------------------------
      const normalizeGender = (
        v: string
      ): 'Laki-laki' | 'Perempuan' | 'Tidak Diketahui' => {
        const s = v.toLowerCase().trim();
        if (!s) return 'Tidak Diketahui';
        if (
          s === 'l' ||
          s === 'lk' ||
          s === 'laki' ||
          s.startsWith('laki') ||
          s.includes('pria')
        )
          return 'Laki-laki';
        if (
          s === 'p' ||
          s === 'pr' ||
          s === 'perempuan' ||
          s.startsWith('perem') ||
          s.includes('wanita')
        )
          return 'Perempuan';
        return 'Tidak Diketahui';
      };

      // FIX UTAMA: urutan pengecekan dibalik — cek 'non' dulu sebelum 'organ'
      // agar "Non Organik" tidak salah masuk ke bucket "Organik".
      // Tambahkan juga pencocokan exact string yang umum dari Excel.
      const normalizePekerja = (
        v: string
      ): 'Organik' | 'Non Organik' | 'Tidak Diketahui' => {
        const s = v.toLowerCase().trim();
        if (!s) return 'Tidak Diketahui';
        // Cek Non Organik lebih dulu supaya tidak kena short-circuit 'organ'
        if (
          s === 'non organik' ||
          s === 'nonorganik' ||
          s.includes('non')
        )
          return 'Non Organik';
        if (s === 'organik' || s.includes('organ')) return 'Organik';
        return 'Tidak Diketahui';
      };

      const normalizePP = (
        v: string
      ): 'Operasional' | 'Non Operasional' | 'Tidak Diketahui' => {
        const s = v.toLowerCase().trim();
        if (!s) return 'Tidak Diketahui';
        if (
          s === 'non operasional' ||
          s === 'nonoperasional' ||
          s.includes('non')
        )
          return 'Non Operasional';
        if (s === 'operasional' || s.includes('oper')) return 'Operasional';
        return 'Tidak Diketahui';
      };

      // ---------------------------------------------------------------
      // Build normalized dataset
      // Daftarkan sebanyak mungkin variasi nama kolom yang mungkin muncul
      // dari hasil upload Excel (spasi, underscore, CamelCase, ALL CAPS).
      // ---------------------------------------------------------------
      const data = raw.map((row) => {
        const jenisKelaminRaw = readField(row, [
          'jenisKelamin',
          'jenis_kelamin',
          'JENIS KELAMIN',
          'jenis kelamin',
          'Jenis Kelamin',
          'JenisKelamin',
          'JENISKELAMIN',
        ]);

        const jenisPekerjaRaw = readField(row, [
          'jenisPekerja',
          'jenis_pekerja',
          'JENIS PEKERJA',
          'jenis pekerja',
          'Jenis Pekerja',
          'JenisPekerja',
          'JENISPEKERJA',
          'jenis_pegawai',
          'JENIS PEGAWAI',
          'jenis pegawai',
          'Jenis Pegawai',
          'tipe_pekerja',
          'Tipe Pekerja',
          'TIPE PEKERJA',
        ]);

        const pusatPelayananRaw = readField(row, [
          'pusatPelayanan',
          'pusat_pelayanan',
          'PUSAT PELAYANAN',
          'pusat pelayanan',
          'Pusat Pelayanan',
          'PusatPelayanan',
          'PUSATPELAYANAN',
        ]);

        const kategoriRaw = readField(row, [
          'kategori',
          'KATEGORI',
          'Kategori',
        ]);

        const entitasRaw = readField(row, [
          'entitas',
          'ENTITAS',
          'Entitas',
        ]);

        const kantorPusatRaw = readField(row, [
          'jaKantorPusat',
          'ja_kantor_pusat',
          'JA KANTOR PUSAT',
          'ja (kantor pusat)',
          'Ja Kantor Pusat',
          'JA_KANTOR_PUSAT',
          'JAKANTORPUSAT',
        ]);

        return {
          jenisKelamin: normalizeGender(jenisKelaminRaw),
          jenisPekerja: normalizePekerja(jenisPekerjaRaw),
          pusatPelayanan: normalizePP(pusatPelayananRaw),
          kategori: kategoriRaw || 'Tidak Diketahui',
          entitas: entitasRaw || 'Tidak Diketahui',
          jaKantorPusat:
            kantorPusatRaw.toLowerCase().startsWith('y') ||
            kantorPusatRaw.toLowerCase() === 'ya'
              ? 'Ya'
              : 'Tidak',
        };
      });

      const totalPekerja = data.length;

      const reduceCount = (accessor: (row: any) => string) => {
        return data.reduce((acc: Record<string, number>, row: any) => {
          const key = accessor(row) || 'Tidak Diketahui';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      };

      const jenisKelamin = reduceCount((r) => r.jenisKelamin);
      const jenisPekerja = reduceCount((r) => r.jenisPekerja);
      const pusatPelayanan = reduceCount((r) => r.pusatPelayanan);
      const kategori = reduceCount((r) => r.kategori);
      const entitas = reduceCount((r) => r.entitas);

      const totalRecords = data.length;
      const toChart = (obj: Record<string, number>) =>
        Object.entries(obj).map(([label, value]) => ({
          label,
          value: value as number,
          percentage: parseFloat(
            (((value as number) / totalRecords) * 100).toFixed(1)
          ),
        }));

      const kantorPusat = data.filter(
        (row: any) => row.jaKantorPusat === 'Ya'
      ).length;
      const nonKantorPusat = totalPekerja - kantorPusat;
      const bopo = parseFloat(
        (kantorPusat > 0 ? (kantorPusat / totalPekerja) * 100 : 0).toFixed(2)
      );
      const rasio = parseFloat(
        (nonKantorPusat > 0 ? (nonKantorPusat / totalPekerja) * 100 : 0).toFixed(
          2
        )
      );
      const produktivitas = parseFloat(
        (
          totalPekerja > 0 ? totalPekerja / (kantorPusat + nonKantorPusat) : 0
        ).toFixed(2)
      );

      // LOG kolom aktual dari baris pertama untuk memudahkan debugging
      if (raw.length > 0) {
        console.log('[SPMT] Kolom aktual di DB:', Object.keys(raw[0]));
        console.log('[SPMT] Sample jenisPekerja raw:', raw[0]);
      }

      return NextResponse.json({
        chartData: [
          { title: 'Jenis Kelamin', data: toChart(jenisKelamin) },
          { title: 'Jenis Pekerja', data: toChart(jenisPekerja) },
          { title: 'Pusat Pelayanan', data: toChart(pusatPelayanan) },
          { title: 'Kategori', data: toChart(kategori) },
          { title: 'Entitas', data: toChart(entitas) },
        ],
        summary: { totalPekerja, bopo, rasio, produktivitas },
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Error fetching SPMT data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SPMT data' },
      { status: 500 }
    );
  }
}

// DELETE - Delete SPMT data by bulan and tahun
export async function DELETE(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');

    if (!bulan || !tahun) {
      return NextResponse.json(
        { success: false, error: 'Bulan dan tahun wajib diisi' },
        { status: 400 }
      );
    }

    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);

    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      return NextResponse.json(
        { success: false, error: 'Bulan harus antara 1-12' },
        { status: 400 }
      );
    }

    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      return NextResponse.json(
        { success: false, error: 'Tahun tidak valid' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // Check if data exists
    const [existingRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM spmtdata WHERE bulan = ? AND tahun = ?',
      [bulanInt, tahunInt]
    );

    const count = (existingRecords as any[])[0]?.count || 0;

    if (count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data tidak ditemukan untuk bulan dan tahun yang dipilih',
        },
        { status: 404 }
      );
    }

    // Delete data
    const [result] = await connection.execute(
      'DELETE FROM spmtdata WHERE bulan = ? AND tahun = ?',
      [bulanInt, tahunInt]
    );

    const affectedRows = (result as any).affectedRows || 0;

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${affectedRows} data SPMT untuk bulan ${bulanInt} tahun ${tahunInt}`,
      deletedCount: affectedRows,
    });
  } catch (error) {
    console.error('Error deleting SPMT data:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus data SPMT' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}