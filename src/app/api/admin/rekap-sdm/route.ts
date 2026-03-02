import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '../../../../lib/db-config';

// Mapping kategori dari status_laporan
const STATUS_MAPPING: { [key: string]: string } = {
  'BOD Pelindo (Penugasan)': 'BOD Pelindo (Penugasan)',
  'BOD Pelindo': 'BOD Pelindo (Penugasan)',
  'BOD PELINDO': 'BOD Pelindo (Penugasan)',
  'BOD Non Pelindo': 'BOD Non Pelindo',
  'BOD NON PELINDO': 'BOD Non Pelindo',
  'Organik Pelindo (Penugasan)': 'Organik Pelindo (Penugasan)',
  'Organik Pelindo': 'Organik Pelindo (Penugasan)',
  'ORGANIK PELINDO': 'Organik Pelindo (Penugasan)',
  'Organik Anak Perusahaan': 'Organik Anak Perusahaan',
  'ORGANIK ANAK PERUSAHAAN': 'Organik Anak Perusahaan',
  'PKWT': 'PKWT',
  'Tenaga Alih Daya': 'Tenaga Alih Daya (TAD)',
  'Tenaga Alih Daya (TAD)': 'Tenaga Alih Daya (TAD)',
  'TENAGA ALIH DAYA': 'Tenaga Alih Daya (TAD)',
  'TAD': 'Tenaga Alih Daya (TAD)',
  'Pekerja Pemegang Saham lainnya': 'Pekerja Pemegang Saham lainnya (N/A)',
  'Pekerja Pemegang Saham lainnya (N/A)': 'Pekerja Pemegang Saham lainnya (N/A)',
  'PEKERJA PEMEGANG SAHAM': 'Pekerja Pemegang Saham lainnya (N/A)',
};

// Kategori yang akan ditampilkan
const CATEGORIES = [
  'BOD Pelindo (Penugasan)',
  'BOD Non Pelindo',
  'Organik Pelindo (Penugasan)',
  'Organik Anak Perusahaan',
  'PKWT',
  'Tenaga Alih Daya (TAD)',
  'Pekerja Pemegang Saham lainnya (N/A)',
];

// Fungsi untuk normalisasi status_laporan
function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const statusTrimmed = status.trim();
  const statusUpper = statusTrimmed.toUpperCase();
  
  // 1. BOD Pelindo (Penugasan) - cek dulu yang spesifik dengan "Penugasan"
  if (statusUpper.includes('BOD') && statusUpper.includes('PELINDO') && statusUpper.includes('PENUGASAN')) {
    return 'BOD Pelindo (Penugasan)';
  }
  
  // 2. BOD Pelindo (tanpa Penugasan) - jika hanya "BOD PELINDO" atau "BOD Pelindo"
  if (statusUpper.includes('BOD') && statusUpper.includes('PELINDO') && !statusUpper.includes('NON')) {
    return 'BOD Pelindo (Penugasan)'; // Default ke Penugasan jika hanya "BOD Pelindo"
  }
  
  // 3. BOD Non Pelindo
  if (statusUpper.includes('BOD') && statusUpper.includes('NON')) {
    return 'BOD Non Pelindo';
  }
  
  // 4. Organik Anak Perusahaan (termasuk "Organik Anper") - cek dulu sebelum Organik Pelindo
  if (statusUpper.includes('ORGANIK') && (statusUpper.includes('ANAK') || statusUpper.includes('ANPER'))) {
    return 'Organik Anak Perusahaan';
  }
  
  // 5. Organik Pelindo (Penugasan) - cek dulu yang spesifik dengan "Penugasan"
  if (statusUpper.includes('ORGANIK') && statusUpper.includes('PELINDO') && statusUpper.includes('PENUGASAN')) {
    return 'Organik Pelindo (Penugasan)';
  }
  
  // 6. Organik Pelindo (tanpa Penugasan) - jika hanya "Organik Pelindo"
  if (statusUpper.includes('ORGANIK') && statusUpper.includes('PELINDO')) {
    return 'Organik Pelindo (Penugasan)'; // Default ke Penugasan jika hanya "Organik Pelindo"
  }
  
  // 7. PKWT (termasuk "PKWT ANPER" atau "PKWT Anper")
  if (statusUpper.includes('PKWT')) {
    // Jika ada "ANPER" setelah PKWT, tetap dikategorikan sebagai PKWT
    return 'PKWT';
  }
  
  // 8. Tenaga Alih Daya (TAD)
  if (statusUpper.includes('TENAGA ALIH DAYA') || statusUpper.includes('TAD') || statusUpper.includes('ALIH DAYA')) {
    return 'Tenaga Alih Daya (TAD)';
  }
  
  // 9. Pekerja Pemegang Saham lainnya
  if (statusUpper.includes('PEKERJA PEMEGANG SAHAM') || statusUpper.includes('PEMEGANG SAHAM')) {
    return 'Pekerja Pemegang Saham lainnya (N/A)';
  }
  
  // Cek mapping langsung (case-sensitive)
  if (STATUS_MAPPING[statusTrimmed]) {
    return STATUS_MAPPING[statusTrimmed];
  }
  
  // Cek mapping dengan case-insensitive
  const mappingKeys = Object.keys(STATUS_MAPPING);
  for (const key of mappingKeys) {
    if (statusUpper === key.toUpperCase()) {
      return STATUS_MAPPING[key];
    }
  }
  
  return null;
}

// Fungsi untuk mendapatkan nama kolom status_laporan berdasarkan tabel
function getStatusColumnName(tableName: string): string {
  // spmtdata menggunakan status_laporan_rakomdir
  if (tableName === 'spmtdata') {
    return 'status_laporan_rakomdir';
  }
  // ptpdata, iktdata, tcudata menggunakan status_laporan
  return 'status_laporan';
}

// Fungsi untuk menghitung data dari satu tabel
async function getDataFromTable(
  connection: mysql.Connection,
  tableName: string,
  bulan: number,
  tahun: number
): Promise<{ [key: string]: number }> {
  const result: { [key: string]: number } = {};
  
  // Inisialisasi semua kategori dengan 0
  CATEGORIES.forEach(cat => {
    result[cat] = 0;
  });
  
  try {
    const statusColumn = getStatusColumnName(tableName);
    // Pastikan hanya menghitung baris dengan status_laporan yang tidak null dan tidak kosong
    // Validasi parameter untuk memastikan tidak ada kesalahan
    if (isNaN(bulan) || bulan < 1 || bulan > 12) {
      console.error(`[getDataFromTable] Invalid bulan: ${bulan}`);
      return result;
    }
    if (isNaN(tahun) || tahun < 2000 || tahun > 2100) {
      console.error(`[getDataFromTable] Invalid tahun: ${tahun}`);
      return result;
    }
    
    const [rows] = await connection.execute(
      `SELECT ${statusColumn} as status_laporan, COUNT(*) as count 
       FROM ${tableName} 
       WHERE bulan = ? AND tahun = ? 
         AND ${statusColumn} IS NOT NULL 
         AND ${statusColumn} != ''
         AND TRIM(${statusColumn}) != ''
       GROUP BY ${statusColumn}`,
      [bulan, tahun]
    );
    
    let totalRawCount = 0;
    let totalNormalizedCount = 0;
    
    (rows as any[]).forEach((row: any) => {
      if (row.status_laporan) {
        totalRawCount += Number(row.count);
        const normalized = normalizeStatus(row.status_laporan);
        if (normalized && CATEGORIES.includes(normalized)) {
          result[normalized] = (result[normalized] || 0) + Number(row.count);
          totalNormalizedCount += Number(row.count);
        }
      }
    });
    
    const totalPerTable = Object.values(result).reduce((sum, val) => sum + val, 0);
  } catch (error) {
    console.error(`Error fetching data from ${tableName}:`, error);
  }
  
  return result;
}

// Fungsi untuk menghitung data kumulatif sampai bulan tertentu
async function getCumulativeDataFromTable(
  connection: mysql.Connection,
  tableName: string,
  bulan: number,
  tahun: number
): Promise<{ [key: string]: number }> {
  const result: { [key: string]: number } = {};
  
  // Inisialisasi semua kategori dengan 0
  CATEGORIES.forEach(cat => {
    result[cat] = 0;
  });
  
  try {
    const statusColumn = getStatusColumnName(tableName);
    // Pastikan hanya menghitung baris dengan status_laporan yang tidak null dan tidak kosong
    const [rows] = await connection.execute(
      `SELECT ${statusColumn} as status_laporan, COUNT(*) as count 
       FROM ${tableName} 
       WHERE tahun = ? AND bulan <= ?
         AND ${statusColumn} IS NOT NULL 
         AND ${statusColumn} != ''
         AND TRIM(${statusColumn}) != ''
       GROUP BY ${statusColumn}`,
      [tahun, bulan]
    );
    
    let totalRawCount = 0;
    let totalNormalizedCount = 0;
    
    (rows as any[]).forEach((row: any) => {
      if (row.status_laporan) {
        totalRawCount += Number(row.count);
        const normalized = normalizeStatus(row.status_laporan);
        if (normalized && CATEGORIES.includes(normalized)) {
          result[normalized] = (result[normalized] || 0) + Number(row.count);
          totalNormalizedCount += Number(row.count);
        }
      }
    });
    
    const totalPerTable = Object.values(result).reduce((sum, val) => sum + val, 0);
  } catch (error) {
    console.error(`Error fetching cumulative data from ${tableName}:`, error);
  }
  
  return result;
}

// Fungsi untuk menggabungkan data dari semua tabel
function mergeData(data1: { [key: string]: number }, data2: { [key: string]: number }): { [key: string]: number } {
  const result: { [key: string]: number } = {};
  CATEGORIES.forEach(cat => {
    result[cat] = (data1[cat] || 0) + (data2[cat] || 0);
  });
  return result;
}

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    
    if (!bulan || !tahun) {
      return NextResponse.json(
        { success: false, message: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      );
    }
    
    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      return NextResponse.json(
        { success: false, message: 'Bulan tidak valid' },
        { status: 400 }
      );
    }
    
    if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      return NextResponse.json(
        { success: false, message: 'Tahun tidak valid' },
        { status: 400 }
      );
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    // Hitung periode untuk perbandingan
    const tahunLalu = tahunInt - 1;
    const bulanSebelumnya = bulanInt === 1 ? 12 : bulanInt - 1;
    const tahunSebelumnya = bulanInt === 1 ? tahunInt - 1 : tahunInt;
    
    // Debug: Log untuk memastikan data yang diambil
    
    // 1. REALISASI S.D BULAN INI TAHUN LALU (hanya bulan yang sama, tahun -1, BUKAN kumulatif)
    const dataTahunLalu = await Promise.all([
      getDataFromTable(connection, 'spmtdata', bulanInt, tahunLalu),
      getDataFromTable(connection, 'ptpdata', bulanInt, tahunLalu),
      getDataFromTable(connection, 'iktdata', bulanInt, tahunLalu),
      getDataFromTable(connection, 'tcudata', bulanInt, tahunLalu),
    ]);
    const realisasiTahunLalu = dataTahunLalu.reduce((acc, data) => mergeData(acc, data), {});
    
    // 2. REALISASI BULAN SEBELUMNYA (bulan -1, tahun sama)
    // Pastikan menggunakan tahun yang sama dengan tahun saat ini, bukan tahun lalu
    const dataBulanSebelumnya = await Promise.all([
      getDataFromTable(connection, 'spmtdata', bulanSebelumnya, tahunSebelumnya),
      getDataFromTable(connection, 'ptpdata', bulanSebelumnya, tahunSebelumnya),
      getDataFromTable(connection, 'iktdata', bulanSebelumnya, tahunSebelumnya),
      getDataFromTable(connection, 'tcudata', bulanSebelumnya, tahunSebelumnya),
    ]);
    const realisasiBulanSebelumnya = dataBulanSebelumnya.reduce((acc, data) => mergeData(acc, data), {});
    
    // 3. REALISASI BULAN INI (hanya bulan yang dipilih, bukan kumulatif)
    const dataBulanIni = await Promise.all([
      getDataFromTable(connection, 'spmtdata', bulanInt, tahunInt),
      getDataFromTable(connection, 'ptpdata', bulanInt, tahunInt),
      getDataFromTable(connection, 'iktdata', bulanInt, tahunInt),
      getDataFromTable(connection, 'tcudata', bulanInt, tahunInt),
    ]);
    const realisasiBulanIni = dataBulanIni.reduce((acc, data) => mergeData(acc, data), {});
    
    // Hitung total untuk BULAN INI SAJA (bukan kumulatif)
    const [totalBulanIniSPMT] = await connection.execute(
      `SELECT COUNT(*) as total FROM spmtdata WHERE tahun = ? AND bulan = ? AND status_laporan_rakomdir IS NOT NULL AND status_laporan_rakomdir != '' AND TRIM(status_laporan_rakomdir) != ''`,
      [tahunInt, bulanInt]
    );
    const [totalBulanIniPTP] = await connection.execute(
      `SELECT COUNT(*) as total FROM ptpdata WHERE tahun = ? AND bulan = ? AND status_laporan IS NOT NULL AND status_laporan != '' AND TRIM(status_laporan) != ''`,
      [tahunInt, bulanInt]
    );
    const [totalBulanIniIKT] = await connection.execute(
      `SELECT COUNT(*) as total FROM iktdata WHERE tahun = ? AND bulan = ? AND status_laporan IS NOT NULL AND status_laporan != '' AND TRIM(status_laporan) != ''`,
      [tahunInt, bulanInt]
    );
    const [totalBulanIniTCU] = await connection.execute(
      `SELECT COUNT(*) as total FROM tcudata WHERE tahun = ? AND bulan = ? AND status_laporan IS NOT NULL AND status_laporan != '' AND TRIM(status_laporan) != ''`,
      [tahunInt, bulanInt]
    );
    
    const totalFromDBBulanIni = 
      Number((totalBulanIniSPMT as any[])[0]?.total || 0) +
      Number((totalBulanIniPTP as any[])[0]?.total || 0) +
      Number((totalBulanIniIKT as any[])[0]?.total || 0) +
      Number((totalBulanIniTCU as any[])[0]?.total || 0);
    
    const totalBulanIni = Object.values(realisasiBulanIni).reduce((sum, val) => sum + val, 0);
    
    // 4. REVISI RKAP TH. (ambil dari tabel rkap_sdm dengan cascade logic)
    // Cascade: jika bulan saat ini tidak ada, gunakan nilai dari bulan sebelumnya, dan seterusnya
    // JIKA TIDAK ADA DATA SAMA SEKALI, KOSONGKAN (jangan gunakan placeholder)
    const revisiRKAP: { [key: string]: number | null } = {};
    
    try {
      // Check if rkap_sdm table exists
      const [tables] = await connection.execute("SHOW TABLES LIKE 'rkap_sdm'");
      
      if (Array.isArray(tables) && tables.length > 0) {
        // Initialize all categories with null (kosong)
        CATEGORIES.forEach(cat => {
          revisiRKAP[cat] = null;
        });
        
        // Cascade logic: cari nilai RKAP dari bulan saat ini, jika tidak ada cari dari bulan sebelumnya
        for (let searchBulan = bulanInt; searchBulan >= 1; searchBulan--) {
          const [rkapRows] = await connection.execute(
            'SELECT kategori, nilai FROM rkap_sdm WHERE bulan = ? AND tahun = ?',
            [searchBulan, tahunInt]
          );
          
          const foundRows = rkapRows as any[];
          
          // Jika ada data untuk bulan ini, isi nilai yang belum terisi
          foundRows.forEach((row: any) => {
            if (CATEGORIES.includes(row.kategori) && revisiRKAP[row.kategori] === null) {
              const nilai = Number(row.nilai);
              // Hanya set jika nilai > 0 (jika 0 berarti kosong)
              revisiRKAP[row.kategori] = nilai > 0 ? nilai : null;
            }
          });
          
          // Jika semua kategori sudah terisi, stop searching
          const allFilled = CATEGORIES.every(cat => revisiRKAP[cat] !== null);
          if (allFilled) {
            break;
          }
        }
        
        // Jangan gunakan placeholder - biarkan null jika tidak ada data
        // CATEGORIES.forEach(cat => {
        //   if (revisiRKAP[cat] === null) {
        //     revisiRKAP[cat] = realisasiTahunLalu[cat] || 0;
        //   }
        // });
      } else {
        // If table doesn't exist, set all to null (kosong)
        CATEGORIES.forEach(cat => {
          revisiRKAP[cat] = null;
        });
      }
    } catch (rkapError) {
      // Set all to null on error (don't use placeholder)
      CATEGORIES.forEach(cat => {
        revisiRKAP[cat] = null;
      });
    }
    
    // Format hasil
    const result = CATEGORIES.map(category => {
      const realisasiTahunLaluVal = realisasiTahunLalu[category] || 0;
      const revisiRKAPVal = revisiRKAP[category] !== null ? revisiRKAP[category] : null;
      const realisasiBulanSebelumnyaVal = realisasiBulanSebelumnya[category] || 0;
      const realisasiBulanIniVal = realisasiBulanIni[category] || 0;
      
      // Hitung capaian YoY: (Realisasi Bulan Ini / Realisasi Tahun Lalu) * 100
      const capaianYoY = realisasiTahunLaluVal > 0 
        ? Math.round((realisasiBulanIniVal / realisasiTahunLaluVal) * 100) 
        : null;
      
      // Hitung capaian FY: (Realisasi Bulan Ini / Revisi RKAP) * 100
      // Hanya hitung jika RKAP tidak null dan > 0
      const capaianFY = revisiRKAPVal !== null && revisiRKAPVal > 0
        ? Math.round((realisasiBulanIniVal / revisiRKAPVal) * 100) 
        : null;
      
      return {
        status: category,
        satuan: 'orang',
        realisasiTahunLalu: realisasiTahunLaluVal,
        revisiRKAP: revisiRKAPVal,
        realisasiBulanSebelumnya: realisasiBulanSebelumnyaVal,
        realisasiBulanIni: realisasiBulanIniVal,
        capaianYoY: capaianYoY,
        capaianFY: capaianFY,
      };
    });
    
    // Hitung total (Jumlah)
    const totalRKAPSum = result.reduce((sum, r) => sum + (r.revisiRKAP !== null ? r.revisiRKAP : 0), 0);
    const totalRKAP = totalRKAPSum > 0 ? totalRKAPSum : null;
    
    const total = {
      status: 'Jumlah',
      satuan: 'orang',
      realisasiTahunLalu: result.reduce((sum, r) => sum + r.realisasiTahunLalu, 0),
      revisiRKAP: totalRKAP,
      realisasiBulanSebelumnya: result.reduce((sum, r) => sum + r.realisasiBulanSebelumnya, 0),
      realisasiBulanIni: result.reduce((sum, r) => sum + r.realisasiBulanIni, 0),
      capaianYoY: (() => {
        const totalTahunLalu = result.reduce((sum, r) => sum + r.realisasiTahunLalu, 0);
        const totalBulanIni = result.reduce((sum, r) => sum + r.realisasiBulanIni, 0);
        return totalTahunLalu > 0 ? Math.round((totalBulanIni / totalTahunLalu) * 100) : null;
      })(),
      capaianFY: (() => {
        const totalBulanIni = result.reduce((sum, r) => sum + r.realisasiBulanIni, 0);
        return totalRKAP !== null && totalRKAP > 0 ? Math.round((totalBulanIni / totalRKAP) * 100) : null;
      })(),
    };
    
    return NextResponse.json({
      success: true,
      data: [...result, total],
      period: {
        bulan: bulanInt,
        tahun: tahunInt,
        bulanSebelumnya: bulanSebelumnya,
        tahunSebelumnya: tahunSebelumnya,
        tahunLalu: tahunLalu,
      },
      debug: {
        totalFromDBBulanIni,
        totalFromCategories: total.realisasiBulanIni,
      },
    });
    
  } catch (error) {
    console.error('[REKAP SDM API] Error fetching rekap SDM:', error);
    if (error instanceof Error) {
      console.error('[REKAP SDM API] Error message:', error.message);
      console.error('[REKAP SDM API] Error stack:', error.stack);
    }
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error fetching rekap SDM data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}


