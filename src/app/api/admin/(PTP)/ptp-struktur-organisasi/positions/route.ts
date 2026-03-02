import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
  port: parseInt(process.env.DB_PORT || '3306'),
};

// Helper function untuk mengkonversi format tanggal ke MySQL DATE format (YYYY-MM-DD)
function formatDateForMySQL(dateValue: any): string | null {
  if (!dateValue) return null;
  
  // Jika sudah dalam format YYYY-MM-DD, return langsung
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  try {
    // PERBAIKAN: Handle Excel serial number (angka yang mewakili hari sejak 1 Januari 1900)
    // Excel serial number biasanya antara 1 (1 Jan 1900) sampai ~50000+ (tahun 2037+)
    // Jika nilai adalah angka dan lebih besar dari 1, kemungkinan adalah Excel serial number
    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(String(dateValue).trim()))) {
      const numValue = typeof dateValue === 'number' ? dateValue : parseFloat(String(dateValue).trim());
      
      // Excel serial number biasanya antara 1 sampai 100000 (untuk tahun 1900-2274)
      // Jika nilai dalam range ini, konversi dari Excel serial number
      if (numValue >= 1 && numValue <= 100000 && Number.isInteger(numValue)) {
        // Excel epoch: 1 Januari 1900 (tapi Excel bug: menganggap 1900 adalah tahun kabisat)
        // Untuk konsistensi dengan bulk-upload route, gunakan 30 Desember 1899 sebagai epoch
        // karena Excel menghitung dari 1 Jan 1900 sebagai hari 1
        const excelEpoch = new Date(1899, 11, 30); // 30 Desember 1899
        const date = new Date(excelEpoch.getTime() + (numValue - 1) * 24 * 60 * 60 * 1000);
        
        // Validasi: pastikan tanggal yang dihasilkan masuk akal (tahun antara 1900-2100)
        const year = date.getFullYear();
        if (year >= 1900 && year <= 2100) {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const formatted = `${year}-${month}-${day}`;
          console.log(`[formatDateForMySQL] Converted Excel serial number ${numValue} to ${formatted}`);
          return formatted;
        } else {
          console.warn(`[formatDateForMySQL] Excel serial number ${numValue} resulted in invalid year ${year}, returning null`);
          return null;
        }
      }
    }
    
    // Coba parse sebagai Date object (untuk format ISO 8601 atau format lainnya)
    const date = new Date(dateValue);
    
    // Cek apakah date valid
    if (isNaN(date.getTime())) {
      // Jika gagal parse dan nilai adalah string yang terlihat seperti tanggal yang salah
      // (misalnya "45231-01-01" dari Excel yang salah format)
      if (typeof dateValue === 'string') {
        const strValue = String(dateValue).trim();
        // Deteksi format yang salah seperti "45231-01-01" (Excel serial number dengan format yang salah)
        const wrongFormatMatch = strValue.match(/^(\d{5,})-\d{2}-\d{2}$/);
        if (wrongFormatMatch) {
          const serialNumber = parseInt(wrongFormatMatch[1]);
          if (serialNumber >= 1 && serialNumber <= 100000) {
            // Konversi dari Excel serial number
            const excelEpoch = new Date(1899, 11, 30); // 30 Desember 1899
            const date = new Date(excelEpoch.getTime() + (serialNumber - 1) * 24 * 60 * 60 * 1000);
            
            const year = date.getFullYear();
            if (year >= 1900 && year <= 2100) {
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const formatted = `${year}-${month}-${day}`;
              console.log(`[formatDateForMySQL] Converted wrong format "${strValue}" (serial ${serialNumber}) to ${formatted}`);
              return formatted;
            }
          }
        }
      }
      return null;
    }
    
    // Validasi: pastikan tanggal yang dihasilkan masuk akal (tahun antara 1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[formatDateForMySQL] Date ${dateValue} resulted in invalid year ${year}, returning null`);
      return null;
    }
    
    // Konversi ke format YYYY-MM-DD
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', dateValue, error);
    return null;
  }
}

async function ensureTable(conn: mysql.Connection) {
  // Create table if not exists
  const ddl = `
    CREATE TABLE IF NOT EXISTS struktur_organisasi_ptp (
      id_posisi_sap VARCHAR(64) NOT NULL,
      id_posisi_atasan VARCHAR(64) NULL,
      daerah_id INT NOT NULL,
      nama VARCHAR(255) NULL,
      jabatan VARCHAR(255) NULL,
      unit_kerja VARCHAR(255) NULL,
      nipp VARCHAR(64) NULL,
      direktorat VARCHAR(255) NULL,
      photo_url VARCHAR(512) NULL,
      no_hp VARCHAR(64) NULL,
      tmt_jabatan DATE NULL,
      periode_jabatan VARCHAR(128) NULL,
      kj_individu VARCHAR(64) NULL,
      kj_posisi VARCHAR(64) NULL,
      bulan INT NULL,
      tahun INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_daerah_id_sap_periode_ptp (daerah_id, id_posisi_sap, bulan, tahun),
      KEY idx_daerah_ptp (daerah_id),
      KEY idx_periode_ptp (bulan, tahun),
      KEY idx_nipp_ptp (nipp),
      CONSTRAINT fk_org_nodes_daerah_ptp FOREIGN KEY (daerah_id) REFERENCES ptp_daerah(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await conn.execute(ddl);

  // Check if columns exist and add missing ones
  const [cols]: any = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'struktur_organisasi_ptp'`,
    [dbConfig.database]
  );
  const have = new Set((cols as any[]).map((r) => r.COLUMN_NAME.toLowerCase()));

  const alters: string[] = [];
  if (!have.has('no_hp')) alters.push(`ADD COLUMN no_hp VARCHAR(64) NULL`);
  if (!have.has('tmt_jabatan')) alters.push(`ADD COLUMN tmt_jabatan DATE NULL`);
  if (!have.has('periode_jabatan')) alters.push(`ADD COLUMN periode_jabatan VARCHAR(128) NULL`);
  if (!have.has('kj_individu')) alters.push(`ADD COLUMN kj_individu VARCHAR(64) NULL`);
  if (!have.has('kj_posisi')) alters.push(`ADD COLUMN kj_posisi VARCHAR(64) NULL`);
  if (!have.has('bulan')) alters.push(`ADD COLUMN bulan INT NULL`);
  if (!have.has('tahun')) alters.push(`ADD COLUMN tahun INT NULL`);

  if (alters.length) {
    await conn.execute(`ALTER TABLE struktur_organisasi_ptp ${alters.join(', ')}`);
  }

  // Update unique key to include bulan and tahun if needed
  if (!have.has('bulan') || !have.has('tahun')) {
    try {
      await conn.execute(`ALTER TABLE struktur_organisasi_ptp DROP INDEX IF EXISTS uniq_daerah_id_sap_ptp`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ptp ADD UNIQUE KEY uniq_daerah_id_sap_periode_ptp (daerah_id, id_posisi_sap, bulan, tahun)`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ptp ADD INDEX idx_periode_ptp (bulan, tahun)`);
    } catch (e: any) {
      console.log('Index update skipped:', e.message);
    }
  }
}

export async function GET(request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const daerahId = searchParams.get('daerah_id');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const directorateParam = searchParams.get('direktorat');
    
    // daerah_id tidak required jika "all" atau tidak ada (untuk "Semua Daerah")
    const isAllDaerah = !daerahId || daerahId === 'all';
    const useDirectorateFilter =
      !!directorateParam && directorateParam.trim() !== '' && directorateParam !== 'all';
    const directorateValue = useDirectorateFilter ? directorateParam!.trim() : null;

    conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);

    // Build WHERE clause dengan filter periode
    // PERBAIKAN: Untuk PTP, ambil semua data untuk periode yang sama (tidak hanya satu daerah)
    // karena ID POSISI SAP bisa sama di beberapa daerah dengan nama yang berbeda
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    // Jika bukan "all", kita tetap ambil semua data untuk periode yang sama
    // tapi nanti akan di-filter di mapping untuk menampilkan nama sesuai daerah
    const targetDaerahId = isAllDaerah ? null : daerahId;

    if (month && year && month !== 'all' && year !== 'all') {
      // Filter berdasarkan bulan dan tahun spesifik
      whereClause += ' AND s.bulan = ? AND s.tahun = ?';
      params.push(parseInt(month), parseInt(year));
    } else if (year && month === 'all' && year !== 'all') {
      // Konsolidasi tahunan - semua bulan dalam tahun tersebut
      whereClause += ' AND s.tahun = ?';
      params.push(parseInt(year));
    } else {
      // Jika all-all atau tidak ada filter periode, ambil data dengan periode terbaru
      try {
        let latestPeriodQuery = `SELECT bulan, tahun FROM struktur_organisasi_ptp 
             WHERE bulan IS NOT NULL AND tahun IS NOT NULL`;
        const latestParams: any[] = [];
        // Untuk PTP, ambil periode terbaru dari semua daerah (tidak filter per daerah)
        // karena kita perlu semua data untuk periode yang sama
        if (useDirectorateFilter) {
          latestPeriodQuery += ' AND direktorat = ?';
          latestParams.push(directorateValue);
        }
        latestPeriodQuery += ' ORDER BY tahun DESC, bulan DESC LIMIT 1';
        
        const [latestPeriod] = await conn.execute(
          latestPeriodQuery,
          latestParams
        );
        if (Array.isArray(latestPeriod) && latestPeriod.length > 0) {
          const latest = latestPeriod[0] as any;
          whereClause += ' AND bulan = ? AND tahun = ?';
          params.push(latest.bulan, latest.tahun);
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          const directorateLabel = useDirectorateFilter ? `, direktorat=${directorateValue}` : '';
          console.log(`[ptp-struktur-organisasi/positions] Using latest period: bulan=${latest.bulan}, tahun=${latest.tahun} for ${daerahLabel}${directorateLabel}`);
        } else {
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          const directorateLabel = useDirectorateFilter ? `, direktorat=${directorateValue}` : '';
          console.log(`[ptp-struktur-organisasi/positions] No period data found for ${daerahLabel}${directorateLabel}, fetching all data`);
        }
    } catch (e) {
        console.log('Error fetching latest period, using all data:', e);
      }
    }

    if (useDirectorateFilter) {
      whereClause += ' AND s.direktorat = ?';
      params.push(directorateValue);
    }

    // Query dengan foto persisten: jika photo_url NULL, ambil dari periode sebelumnya
    const [rows] = await conn.execute(
      `SELECT 
        s.id_posisi_sap, 
        s.id_posisi_atasan, 
        s.daerah_id, 
        s.nama, 
        s.jabatan, 
        s.unit_kerja, 
        s.nipp, 
        s.direktorat, 
        COALESCE(
          s.photo_url,
          (SELECT photo_url 
           FROM struktur_organisasi_ptp s2
           WHERE s2.nipp = s.nipp 
             AND s2.daerah_id = s.daerah_id
             AND s2.photo_url IS NOT NULL
             AND (s2.tahun < s.tahun OR (s2.tahun = s.tahun AND s2.bulan < s.bulan))
           ORDER BY s2.tahun DESC, s2.bulan DESC
           LIMIT 1)
        ) as photo_url,
        s.no_hp, 
        s.tmt_jabatan, 
        s.periode_jabatan, 
        s.kj_individu, 
        s.kj_posisi, 
        s.bulan, 
        s.tahun
       FROM struktur_organisasi_ptp s ${whereClause} ORDER BY s.id_posisi_sap ASC`,
      params
    );

    // PERBAIKAN: Untuk PTP, jika ada ID POSISI SAP yang sama di beberapa daerah,
    // kita perlu memastikan setiap daerah menampilkan nama yang sesuai.
    // Strategi: Jika ada targetDaerahId, ambil semua data untuk periode yang sama,
    // lalu filter untuk menampilkan data dari daerah target dengan nama yang sesuai.
    // Untuk parent nodes yang tidak ada di daerah target, ambil dari daerah lain.
    
    // Map semua data terlebih dahulu
    // PERBAIKAN: Untuk PTP, buat ID node yang unik untuk setiap kombinasi ID POSISI SAP + daerah_id
    // Ini memastikan setiap daerah memiliki node sendiri dengan nama yang sesuai
    const allMapped = (rows as any[]).map((row: any) => {
      const sapId = String(row.id_posisi_sap || '').trim();
      const daerahId = row.daerah_id;
      
      // Buat ID node yang unik: kombinasi ID POSISI SAP + daerah_id
      // Ini memastikan setiap daerah memiliki node sendiri dengan nama yang sesuai
      const uniqueId = `${sapId}_${daerahId}`;
      
      return {
        id: uniqueId, // ID unik untuk setiap kombinasi SAP + daerah
        daerah_id: daerahId,
        id_posisi_sap: sapId, // Tetap simpan ID POSISI SAP asli untuk hierarki
        id_posisi_atasan: row.id_posisi_atasan,
        nama_posisi: row.jabatan,
        nama_jabatan_sap: row.jabatan,
        unit_kerja: row.unit_kerja,
        nipp: row.nipp,
        nama: row.nama, // Nama sesuai dengan daerah_id-nya
        tingkatan: null,
        direktorat: row.direktorat,
        photo_url: row.photo_url,
        no_hp: row.no_hp,
        tmt_jabatan: row.tmt_jabatan,
        periode_jabatan: row.periode_jabatan,
        kj_individu: row.kj_individu,
        kj_posisi: row.kj_posisi,
        bulan: row.bulan,
        tahun: row.tahun,
      };
    });
    
    // Jika ada targetDaerahId, filter untuk menampilkan data dari daerah target
    // Tapi untuk parent nodes yang tidak ada di daerah target, ambil dari daerah lain dengan nama sesuai daerah asalnya
    let mapped = allMapped;
    if (targetDaerahId) {
      // Ambil semua data dari daerah target
      const dataFromTargetDaerah = allMapped.filter(
        m => String(m.daerah_id) === String(targetDaerahId)
      );
      
      // Ambil semua SAP IDs yang ada di daerah target
      const sapIdsInTargetDaerah = new Set(
        dataFromTargetDaerah.map(m => m.id_posisi_sap)
      );
      
      // Ambil semua parent IDs yang diperlukan untuk hierarki
      const requiredParentIds = new Set<string>();
      for (const m of dataFromTargetDaerah) {
        if (m.id_posisi_atasan) {
          requiredParentIds.add(String(m.id_posisi_atasan).trim());
        }
      }
      
      // Untuk setiap required parent ID, cari data dari daerah target dulu,
      // jika tidak ada, ambil dari daerah lain (dengan nama sesuai daerah asalnya)
      const parentData = new Map<string, any>();
      for (const parentId of requiredParentIds) {
        // Cari dari daerah target dulu
        let parentRow = dataFromTargetDaerah.find(m => m.id_posisi_sap === parentId);
        if (!parentRow) {
          // Jika tidak ada di daerah target, cari dari daerah lain
          // Ambil yang pertama ditemukan (bisa dari daerah manapun)
          parentRow = allMapped.find(m => m.id_posisi_sap === parentId);
        }
        if (parentRow && !parentData.has(parentId)) {
          parentData.set(parentId, parentRow);
        }
      }
      
      // Gabungkan data dari daerah target + parent nodes yang diperlukan
      const result = [...dataFromTargetDaerah];
      for (const parentRow of parentData.values()) {
        // Hanya tambahkan jika belum ada di result
        if (!result.some(r => r.id_posisi_sap === parentRow.id_posisi_sap && 
                             String(r.daerah_id) === String(parentRow.daerah_id))) {
          result.push(parentRow);
        }
      }
      
      // PERBAIKAN: Karena kita sudah menggunakan ID unik (sapId_daerahId), tidak perlu deduplicate
      // Setiap node sudah memiliki ID unik sesuai daerahnya, jadi semua data dari result bisa langsung digunakan
      // Tapi kita perlu memastikan parent-child relationship menggunakan ID POSISI SAP, bukan ID unik
      mapped = result;
      
      // PERBAIKAN: Pastikan semua required parent IDs ada di result
      // Jika parent ID tidak ada di daerah target, ambil dari daerah lain dengan nama sesuai daerah asalnya
      for (const parentId of requiredParentIds) {
        const existsInResult = result.some(r => r.id_posisi_sap === parentId);
        if (!existsInResult) {
          // Cari dari semua data (bukan hanya dari daerah target)
          const parentFromOtherDaerah = allMapped.find(
            m => m.id_posisi_sap === parentId
          );
          if (parentFromOtherDaerah) {
            // Tambahkan parent dari daerah lain dengan nama sesuai daerah asalnya
            mapped.push(parentFromOtherDaerah);
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('GET /api/admin/ptp-struktur-organisasi/positions error', error);
    const errorMessage = error?.message || 'Failed to fetch data from database';
    return NextResponse.json({ 
      success: false, 
      error: `Error loading PTP structure: ${errorMessage}` 
    }, { status: 500 });
  } finally {
    try {
      if (conn) await conn.end();
    } catch (e) {
      console.error('Error closing connection:', e);
    }
  }
}

export async function POST(request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    const body = await request.json();
    const { daerah_id, items, bulan, tahun } = body || {};

    if (!daerah_id || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'daerah_id and items[] are required' }, { status: 400 });
    }

    // Validasi bulan dan tahun
    if (!bulan || !tahun || bulan === 'all' || tahun === 'all') {
      return NextResponse.json({ success: false, error: 'bulan and tahun are required' }, { status: 400 });
    }

    conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);

    // Logging untuk debugging - lihat nilai photo_url yang diterima
    if (items.length === 1) {
      console.log(`[ptp-struktur-organisasi/positions] POST - Received request for single node:`, {
        id_posisi_sap: items[0].id_posisi_sap,
        photo_url: items[0].photo_url || 'NULL/EMPTY',
        nama: items[0].nama,
        bulan,
        tahun
      });
    }

    // Validasi: Pastikan daerah_id ada di tabel ptp_daerah
    // Cek apakah daerah_id valid (bisa berupa string atau number)
    const daerahIdNum = typeof daerah_id === 'string' ? parseInt(daerah_id) : daerah_id;
    if (isNaN(daerahIdNum)) {
      await conn.end();
      return NextResponse.json(
        { success: false, error: `daerah_id ${daerah_id} tidak valid` },
        { status: 400 }
      );
    }
    
    const [daerahCheck] = await conn.execute(
      'SELECT id FROM ptp_daerah WHERE id = ?',
      [daerahIdNum]
    );
    if (!Array.isArray(daerahCheck) || daerahCheck.length === 0) {
      await conn.end();
      return NextResponse.json(
        { success: false, error: `daerah_id ${daerahIdNum} tidak ditemukan di tabel ptp_daerah. Pastikan daerah PTP sudah ada di sistem.` },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    const values: any[] = [];
    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    // PERBAIKAN: Pastikan bulan dan tahun selalu non-NULL
    if (isNaN(bulanInt) || isNaN(tahunInt)) {
      await conn.rollback();
      await conn.end();
      return NextResponse.json(
        { success: false, error: 'bulan and tahun must be valid integers' },
        { status: 400 }
      );
    }
    
    for (const it of items) {
      const sap = String(it.id_posisi_sap || '').trim();
      if (!sap) continue;
      
      // PERBAIKAN: Pastikan bulan dan tahun selalu dari request body, bukan dari item
      // Ini memastikan update hanya terjadi pada periode yang dipilih
      const finalBulan = it.bulan !== undefined && it.bulan !== null ? parseInt(String(it.bulan)) : bulanInt;
      const finalTahun = it.tahun !== undefined && it.tahun !== null ? parseInt(String(it.tahun)) : tahunInt;
      
      // Pastikan tidak NULL
      const finalBulanSafe = isNaN(finalBulan) ? bulanInt : finalBulan;
      const finalTahunSafe = isNaN(finalTahun) ? tahunInt : finalTahun;
      
      values.push([
        sap,
        it.id_posisi_atasan ? String(it.id_posisi_atasan).trim() : null,
        daerah_id,
        it.nama ?? null,
        (it.nama_posisi || it.nama_jabatan_sap) ?? null,
        it.unit_kerja ?? null,
        it.nipp ?? null,
        it.direktorat ?? null,
        it.photo_url ?? null,
        it.no_hp ?? null,
        formatDateForMySQL(it.tmt_jabatan),
        it.periode_jabatan ?? null,
        it.kj_individu ?? null,
        it.kj_posisi ?? null,
        finalBulanSafe,  // PERBAIKAN: Gunakan finalBulanSafe yang sudah dipastikan tidak NULL
        finalTahunSafe,  // PERBAIKAN: Gunakan finalTahunSafe yang sudah dipastikan tidak NULL
      ]);
    }

    if (values.length === 0) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'No valid items to import' }, { status: 400 });
    }

    // PERBAIKAN: Hanya hapus data jika menyimpan banyak items (bulk upload)
    // Jika hanya menyimpan satu node (edit individual), gunakan UPSERT saja tanpa DELETE
    // Ini mencegah data lain (termasuk foto yang sudah di-upload) hilang
    const isBulkUpload = values.length > 1;
    
    if (isBulkUpload) {
      // Untuk bulk upload, hapus data lama untuk daerah dan periode ini sebelum insert baru
      console.log(`[ptp-struktur-organisasi/positions] Bulk upload: Deleting ${values.length} old records for daerah ${daerah_id}, periode ${bulanInt}/${tahunInt}`);
      await conn.execute('DELETE FROM struktur_organisasi_ptp WHERE daerah_id = ? AND bulan = ? AND tahun = ?', 
        [daerah_id, bulanInt, tahunInt]);
    } else {
      // PERBAIKAN: Untuk single node update, gunakan UPDATE eksplisit dengan WHERE clause
      // yang mencakup bulan dan tahun untuk memastikan hanya update periode yang dipilih
      // Ini mencegah update ke periode lain
      console.log(`[ptp-struktur-organisasi/positions] Single node update: Using explicit UPDATE with WHERE clause for periode ${bulanInt}/${tahunInt}`);
      const singleValue = values[0];
      const [updateResult]: any = await conn.execute(`
        UPDATE struktur_organisasi_ptp
        SET
          id_posisi_atasan = ?,
          nama = ?,
          jabatan = ?,
          unit_kerja = ?,
          nipp = ?,
          direktorat = ?,
          photo_url = CASE 
            WHEN ? IS NOT NULL AND TRIM(?) != '' 
            THEN ? 
            ELSE photo_url 
          END,
          no_hp = ?,
          tmt_jabatan = ?,
          periode_jabatan = ?,
          kj_individu = ?,
          kj_posisi = ?
        WHERE id_posisi_sap = ? 
          AND daerah_id = ? 
          AND bulan = ? 
          AND tahun = ?
      `, [
        singleValue[1], // id_posisi_atasan
        singleValue[3], // nama
        singleValue[4], // jabatan
        singleValue[5], // unit_kerja
        singleValue[6], // nipp
        singleValue[7], // direktorat
        singleValue[8], singleValue[8], singleValue[8], // photo_url (3x untuk CASE)
        singleValue[9], // no_hp
        singleValue[10], // tmt_jabatan
        singleValue[11], // periode_jabatan
        singleValue[12], // kj_individu
        singleValue[13], // kj_posisi
        singleValue[0], // id_posisi_sap (untuk WHERE)
        singleValue[2], // daerah_id (untuk WHERE)
        singleValue[14], // bulan (untuk WHERE)
        singleValue[15], // tahun (untuk WHERE)
      ]);
      
      // Jika tidak ada row yang di-update, insert baru
      if (updateResult.affectedRows === 0) {
        console.log(`[ptp-struktur-organisasi/positions] No row updated, inserting new row for periode ${bulanInt}/${tahunInt}`);
        await conn.execute(`
          INSERT INTO struktur_organisasi_ptp
            (id_posisi_sap, id_posisi_atasan, daerah_id, nama, jabatan, unit_kerja, nipp, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, singleValue);
      } else {
        console.log(`[ptp-struktur-organisasi/positions] Updated ${updateResult.affectedRows} row(s) for periode ${bulanInt}/${tahunInt}`);
      }
    }

    // Bulk insert hanya untuk bulk upload
    if (isBulkUpload) {
      const batchSize = 500;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        await conn.execute(`
          INSERT INTO struktur_organisasi_ptp
            (id_posisi_sap, id_posisi_atasan, daerah_id, nama, jabatan, unit_kerja, nipp, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            id_posisi_atasan = VALUES(id_posisi_atasan),
            nama = VALUES(nama),
            jabatan = VALUES(jabatan),
            unit_kerja = VALUES(unit_kerja),
            nipp = VALUES(nipp),
            direktorat = VALUES(direktorat),
            photo_url = CASE 
              WHEN VALUES(photo_url) IS NOT NULL AND TRIM(VALUES(photo_url)) != '' 
              THEN VALUES(photo_url) 
              ELSE photo_url 
            END,
            no_hp = VALUES(no_hp),
            tmt_jabatan = VALUES(tmt_jabatan),
            periode_jabatan = VALUES(periode_jabatan),
            kj_individu = VALUES(kj_individu),
            kj_posisi = VALUES(kj_posisi)
        `, batch.flat());
      }
    }

    // Update foto dari periode sebelumnya untuk row yang photo_url NULL (menggunakan JOIN)
    await conn.execute(`
      UPDATE struktur_organisasi_ptp s
      INNER JOIN (
        SELECT 
          s2.nipp,
          s2.daerah_id,
          s2.photo_url,
          ROW_NUMBER() OVER (PARTITION BY s2.nipp, s2.daerah_id ORDER BY s2.tahun DESC, s2.bulan DESC) as rn
        FROM struktur_organisasi_ptp s2
        WHERE s2.photo_url IS NOT NULL
          AND s2.daerah_id = ?
          AND (s2.tahun < ? OR (s2.tahun = ? AND s2.bulan < ?))
          AND s2.nipp IS NOT NULL
      ) prev ON prev.nipp = s.nipp 
        AND prev.daerah_id = s.daerah_id 
        AND prev.rn = 1
      SET s.photo_url = prev.photo_url
      WHERE s.daerah_id = ? 
        AND s.bulan = ? 
        AND s.tahun = ?
        AND s.photo_url IS NULL
        AND s.nipp IS NOT NULL
    `, [daerah_id, tahunInt, tahunInt, bulanInt, daerah_id, bulanInt, tahunInt]);

    // Fallback: jika NIPP NULL, cari berdasarkan id_posisi_sap
    await conn.execute(`
      UPDATE struktur_organisasi_ptp s
      INNER JOIN (
        SELECT 
          s2.id_posisi_sap,
          s2.daerah_id,
          s2.photo_url,
          ROW_NUMBER() OVER (PARTITION BY s2.id_posisi_sap, s2.daerah_id ORDER BY s2.tahun DESC, s2.bulan DESC) as rn
        FROM struktur_organisasi_ptp s2
        WHERE s2.photo_url IS NOT NULL
          AND s2.daerah_id = ?
          AND (s2.tahun < ? OR (s2.tahun = ? AND s2.bulan < ?))
          AND s2.nipp IS NULL
      ) prev ON prev.id_posisi_sap = s.id_posisi_sap 
        AND prev.daerah_id = s.daerah_id 
        AND prev.rn = 1
      SET s.photo_url = prev.photo_url
      WHERE s.daerah_id = ? 
        AND s.bulan = ? 
        AND s.tahun = ?
        AND s.photo_url IS NULL
        AND s.nipp IS NULL
    `, [daerah_id, tahunInt, tahunInt, bulanInt, daerah_id, bulanInt, tahunInt]);

    await conn.commit();

    // PERBAIKAN: Verifikasi data yang tersimpan setelah INSERT/UPDATE
    if (values.length === 1) {
      try {
        const singleValue = values[0];
        const [verifyRows]: any = await conn.execute(
          `SELECT id_posisi_sap, nama, direktorat, photo_url, no_hp, kj_individu, kj_posisi, bulan, tahun
           FROM struktur_organisasi_ptp 
           WHERE daerah_id = ? AND id_posisi_sap = ? AND bulan = ? AND tahun = ?`,
          [daerah_id, singleValue[0], bulanInt, tahunInt]
        );
        
        if (Array.isArray(verifyRows) && verifyRows.length > 0) {
          const savedData = verifyRows[0];
          console.log(`[ptp-struktur-organisasi/positions] POST - Verification after save:`, {
            id_posisi_sap: savedData.id_posisi_sap,
            nama: savedData.nama,
            direktorat: savedData.direktorat || 'NULL',
            photo_url: savedData.photo_url || 'NULL',
            no_hp: savedData.no_hp || 'NULL',
            kj_individu: savedData.kj_individu || 'NULL',
            kj_posisi: savedData.kj_posisi || 'NULL',
            bulan: savedData.bulan,
            tahun: savedData.tahun
          });
        }
      } catch (verifyErr) {
        console.error(`[ptp-struktur-organisasi/positions] POST - Error verifying saved data:`, verifyErr);
      }
    }

    return NextResponse.json({ success: true, imported: values.length });
  } catch (error) {
    console.error('POST /api/admin/ptp-struktur-organisasi/positions error', error);
    try { if (conn) await conn.rollback(); } catch {}
    const message = (error as any)?.message || 'Failed to import';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    try { if (conn) await conn.end(); } catch {}
  }
}

