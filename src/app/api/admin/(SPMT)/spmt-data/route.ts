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
        return NextResponse.json({ chartData: [], summary: { totalPekerja: 0, bopo: 0, rasio: 0, produktivitas: 0 } });
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

      const [rows] = await connection.execute(`SELECT * FROM spmtdata ${whereClause}`, params);
      const raw = rows as any[];

      if (raw.length === 0) {
        return NextResponse.json({ chartData: [], summary: { totalPekerja: 0, bopo: 0, rasio: 0, produktivitas: 0 } });
      }

      // Helpers to read flexible column names and normalize values
      const readField = (row: any, keys: string[]): string => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        return '';
      };

      const normalizeGender = (v: string): 'Laki-laki' | 'Perempuan' | 'Tidak Diketahui' => {
        const s = v.toLowerCase();
        if (!s) return 'Tidak Diketahui';
        if (s === 'l' || s.startsWith('laki') || s.includes('pria') || s === 'lk') return 'Laki-laki';
        if (s === 'p' || s.startsWith('perem') || s.includes('wanita')) return 'Perempuan';
        return 'Tidak Diketahui';
      };

      const normalizePekerja = (v: string): 'Organik' | 'Non Organik' | 'Tidak Diketahui' => {
        const s = v.toLowerCase();
        if (!s) return 'Tidak Diketahui';
        if (s.includes('non')) return 'Non Organik';
        if (s.includes('organ')) return 'Organik';
        return 'Tidak Diketahui';
      };

      const normalizePP = (v: string): 'Operasional' | 'Non Operasional' | 'Tidak Diketahui' => {
        const s = v.toLowerCase();
        if (!s) return 'Tidak Diketahui';
        if (s.includes('non')) return 'Non Operasional';
        if (s.includes('oper')) return 'Operasional';
        return 'Tidak Diketahui';
      };

      // Build normalized dataset
      const data = raw.map((row) => {
        const jenisKelaminRaw = readField(row, ['jenisKelamin', 'jenis_kelamin', 'JENIS KELAMIN', 'jenis kelamin']);
        const jenisPekerjaRaw = readField(row, ['jenisPekerja', 'jenis_pekerja', 'JENIS PEKERJA', 'jenis pekerja']);
        const pusatPelayananRaw = readField(row, ['pusatPelayanan', 'pusat_pelayanan', 'PUSAT PELAYANAN', 'pusat pelayanan']);
        const kategoriRaw = readField(row, ['kategori', 'KATEGORI']);
        const entitasRaw = readField(row, ['entitas', 'ENTITAS']);
        const kantorPusatRaw = readField(row, ['jaKantorPusat', 'ja_kantor_pusat', 'JA KANTOR PUSAT', 'ja (kantor pusat)']);

        return {
          jenisKelamin: normalizeGender(jenisKelaminRaw),
          jenisPekerja: normalizePekerja(jenisPekerjaRaw),
          pusatPelayanan: normalizePP(pusatPelayananRaw),
          kategori: kategoriRaw || 'Tidak Diketahui',
          entitas: entitasRaw || 'Tidak Diketahui',
          jaKantorPusat: kantorPusatRaw.toLowerCase().startsWith('y') || kantorPusatRaw.toLowerCase() === 'ya' ? 'Ya' : 'Tidak',
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
          percentage: parseFloat(((value as number) / totalRecords * 100).toFixed(1)),
        }));

      const kantorPusat = data.filter((row: any) => row.jaKantorPusat === 'Ya').length;
      const nonKantorPusat = totalPekerja - kantorPusat;
      const bopo = parseFloat(((kantorPusat > 0 ? (kantorPusat / totalPekerja * 100) : 0).toFixed(2)));
      const rasio = parseFloat(((nonKantorPusat > 0 ? (nonKantorPusat / totalPekerja * 100) : 0).toFixed(2)));
      const produktivitas = parseFloat(((totalPekerja > 0 ? (totalPekerja / (kantorPusat + nonKantorPusat)) : 0).toFixed(2)));

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
    return NextResponse.json({ error: 'Failed to fetch SPMT data' }, { status: 500 });
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
        { success: false, error: 'Data tidak ditemukan untuk bulan dan tahun yang dipilih' },
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
      deletedCount: affectedRows
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
