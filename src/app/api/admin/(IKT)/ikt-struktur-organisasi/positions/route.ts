import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

// Helper function untuk mengkonversi format tanggal ke MySQL DATE format (YYYY-MM-DD)
// Menangani berbagai format: Excel serial number, string date, Date object
function formatDateForMySQL(dateValue: any): string | null {
  if (!dateValue) return null;
  
  // Jika sudah dalam format YYYY-MM-DD, return langsung
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  try {
    // PERBAIKAN: Handle Excel date serial number (angka seperti 45034)
    // Excel menyimpan tanggal sebagai jumlah hari sejak 1 Januari 1900 (Windows) atau 1904 (Mac)
    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(String(dateValue).trim()))) {
      const serialNumber = typeof dateValue === 'number' ? dateValue : parseFloat(String(dateValue).trim());
      
      // Validasi: serial number harus masuk akal (antara 1 dan 100000, yang berarti 1900-2174)
      if (serialNumber > 0 && serialNumber < 100000) {
        // Excel epoch: 1 Januari 1900 (Windows) - Excel menghitung 1 Jan 1900 sebagai hari 1
        // JavaScript Date epoch: 1 Januari 1970
        // Konversi: (serialNumber - 1) hari sejak 1 Jan 1900
        // Karena Excel salah menghitung 1900 sebagai tahun kabisat, kita perlu adjust
        const excelEpoch = new Date(1899, 11, 30); // 30 Des 1899 (Excel menghitung 1 Jan 1900 sebagai hari 1)
        const date = new Date(excelEpoch.getTime() + (serialNumber - 1) * 86400 * 1000);
        
        // Validasi: tahun harus masuk akal (1900-2100)
        const year = date.getFullYear();
        if (year >= 1900 && year <= 2100) {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // Coba parse sebagai Date object atau string date
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      // PERBAIKAN: Jika gagal parse dan nilai adalah string yang terlihat seperti tanggal yang salah
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
    
    // Validasi: tahun harus masuk akal
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[formatDateForMySQL] Date ${dateValue} resulted in invalid year ${year}, returning null`);
      return null;
    }
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', dateValue, error);
    return null;
  }
}

async function ensureTable(conn: mysql.Connection) {
  // PERBAIKAN: Pastikan tabel ikt_daerah ada terlebih dahulu
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ikt_daerah (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        kode VARCHAR(10) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error('[IKT] Error creating ikt_daerah table:', err);
  }
  
  // Create table if not exists
  const ddl = `
    CREATE TABLE IF NOT EXISTS struktur_organisasi_ikt (
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
      UNIQUE KEY uniq_daerah_id_sap_direktorat_periode_ikt (daerah_id, id_posisi_sap, direktorat, bulan, tahun),
      KEY idx_daerah_ikt (daerah_id),
      KEY idx_periode_ikt (bulan, tahun),
      KEY idx_nipp_ikt (nipp),
      CONSTRAINT fk_org_nodes_daerah_ikt FOREIGN KEY (daerah_id) REFERENCES ikt_daerah(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await conn.execute(ddl);

  // PERBAIKAN: Drop foreign key constraint lama jika mengarah ke tabel `daerah` (bukan `ikt_daerah`)
  try {
    // Drop constraint yang mengarah ke `daerah`
    const [constraints]: any = await conn.execute(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'struktur_organisasi_ikt' 
      AND REFERENCED_TABLE_NAME = 'daerah'
      AND CONSTRAINT_NAME LIKE 'fk_%'
    `, [dbConfig.database]);
    
    if (Array.isArray(constraints) && constraints.length > 0) {
      for (const constraint of constraints) {
        try {
          await conn.execute(`ALTER TABLE struktur_organisasi_ikt DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
          console.log(`[IKT] Dropped old foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
        } catch (e: any) {
          console.log(`[IKT] Error dropping constraint ${constraint.CONSTRAINT_NAME}:`, e.message);
        }
      }
    }
    
    // PERBAIKAN: Drop constraint yang mengarah ke ikt_daerah juga (jika ada) untuk memastikan tidak ada duplikat
    const [existingConstraints]: any = await conn.execute(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'struktur_organisasi_ikt' 
      AND REFERENCED_TABLE_NAME = 'ikt_daerah'
      AND CONSTRAINT_NAME LIKE 'fk_%'
    `, [dbConfig.database]);
    
    if (Array.isArray(existingConstraints) && existingConstraints.length > 0) {
      for (const constraint of existingConstraints) {
        try {
          await conn.execute(`ALTER TABLE struktur_organisasi_ikt DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
          console.log(`[IKT] Dropped existing foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
        } catch (e: any) {
          console.log(`[IKT] Error dropping constraint ${constraint.CONSTRAINT_NAME}:`, e.message);
        }
      }
    }
    
    // Re-add correct foreign key constraint
    try {
      await conn.execute(`
        ALTER TABLE struktur_organisasi_ikt 
        ADD CONSTRAINT fk_org_nodes_daerah_ikt 
        FOREIGN KEY (daerah_id) REFERENCES ikt_daerah(id) ON DELETE CASCADE
      `);
      console.log('[IKT] Added correct foreign key constraint to ikt_daerah');
    } catch (e: any) {
      // Constraint mungkin sudah ada, skip
      if (!e.message.includes('Duplicate') && !e.message.includes('already exists')) {
        console.log('[IKT] Error adding foreign key constraint:', e.message);
      }
    }
  } catch (err) {
    console.error('[IKT] Error checking/updating foreign key constraints:', err);
  }

  // Check if columns exist and add missing ones
  const [cols]: any = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'struktur_organisasi_ikt'`,
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
    await conn.execute(`ALTER TABLE struktur_organisasi_ikt ${alters.join(', ')}`);
  }

  // Update unique key to include direktorat, bulan and tahun if needed
  // Check if unique key already includes direktorat
  const [indexes]: any = await conn.execute(
    `SELECT INDEX_NAME, COLUMN_NAME 
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'struktur_organisasi_ikt' 
     AND INDEX_NAME LIKE 'uniq_%'`,
    [dbConfig.database]
  );
  
  const hasDirektoratInUniqueKey = Array.isArray(indexes) && indexes.some(
    (idx: any) => idx.INDEX_NAME.includes('direktorat')
  );
  
  if (!hasDirektoratInUniqueKey) {
    try {
      // Drop old unique keys
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt DROP INDEX IF EXISTS uniq_daerah_id_sap_ikt`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt DROP INDEX IF EXISTS uniq_daerah_id_sap_periode_ikt`);
      
      // Add new unique key with direktorat
      // Note: MySQL doesn't support COALESCE in unique key, so we'll use a workaround
      // For NULL direktorat, we'll use empty string in the unique constraint
      await conn.execute(`
        ALTER TABLE struktur_organisasi_ikt 
        ADD UNIQUE KEY uniq_daerah_id_sap_direktorat_periode_ikt 
        (daerah_id, id_posisi_sap, direktorat, bulan, tahun)
      `);
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt ADD INDEX idx_periode_ikt (bulan, tahun)`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt ADD INDEX idx_direktorat_ikt (direktorat)`);
      console.log('[ikt-struktur-organisasi] Updated unique key to include direktorat');
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
    const directorateParam = searchParams.get('direktorat'); // NEW: Add directorate filter
    
    // daerah_id tidak required jika "all" atau tidak ada (untuk "Semua Daerah")
    const isAllDaerah = !daerahId || daerahId === 'all';
    const useDirectorateFilter =
      !!directorateParam && directorateParam.trim() !== '' && directorateParam !== 'all';
    const directorateValue = useDirectorateFilter ? directorateParam!.trim() : null;

    conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);

    // Build WHERE clause dengan filter periode
    let whereClause = isAllDaerah ? 'WHERE 1=1' : 'WHERE s.daerah_id = ?';
    const params: any[] = isAllDaerah ? [] : [daerahId];

    // NEW: Add direktorat filter
    if (useDirectorateFilter) {
      whereClause += ' AND s.direktorat = ?';
      params.push(directorateValue);
    }

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
        let latestPeriodQuery = `SELECT bulan, tahun FROM struktur_organisasi_ikt 
             WHERE bulan IS NOT NULL AND tahun IS NOT NULL`;
        const latestParams: any[] = [];
        if (!isAllDaerah) {
          latestPeriodQuery += ' AND daerah_id = ?';
          latestParams.push(daerahId);
        }
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
          whereClause += ' AND s.bulan = ? AND s.tahun = ?';
          params.push(latest.bulan, latest.tahun);
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          const direktoratLabel = useDirectorateFilter ? `, direktorat=${directorateValue}` : '';
          console.log(`[ikt-struktur-organisasi/positions] Using latest period: bulan=${latest.bulan}, tahun=${latest.tahun} for ${daerahLabel}${direktoratLabel}`);
        } else {
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          const direktoratLabel = useDirectorateFilter ? `, direktorat=${directorateValue}` : '';
          console.log(`[ikt-struktur-organisasi/positions] No period data found for ${daerahLabel}${direktoratLabel}, fetching all data`);
        }
      } catch (e) {
        console.log('Error fetching latest period, using all data:', e);
      }
    }

    const [rows] = await conn.execute(
      `SELECT s.id_posisi_sap, s.id_posisi_atasan, s.daerah_id, s.nama, s.jabatan, s.unit_kerja, s.nipp, s.direktorat, s.photo_url, s.no_hp, s.tmt_jabatan, s.periode_jabatan, s.kj_individu, s.kj_posisi, s.bulan, s.tahun
       FROM struktur_organisasi_ikt s ${whereClause} ORDER BY s.id_posisi_sap ASC`,
      params
    );

    // PERBAIKAN: Untuk IKT, buat ID node yang unik untuk setiap kombinasi ID POSISI SAP + daerah_id
    // Ini memastikan setiap direktorat memiliki node sendiri dengan nama yang sesuai
    // Format: sapId_daerahId (sama seperti PTP)
    const mapped = (rows as any[]).map((row: any) => {
      const sapId = String(row.id_posisi_sap || '').trim();
      const daerahId = row.daerah_id;
      
      // Buat ID node yang unik: kombinasi ID POSISI SAP + daerah_id
      // Ini memastikan setiap direktorat memiliki node sendiri dengan nama yang sesuai
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

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('GET /api/admin/ikt-struktur-organisasi/positions error', error);
    const errorMessage = error?.message || 'Failed to fetch data from database';
    return NextResponse.json({ 
      success: false, 
      error: `Error loading IKT structure: ${errorMessage}` 
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

    if (!bulan || !tahun || bulan === 'all' || tahun === 'all') {
      return NextResponse.json({ success: false, error: 'bulan and tahun are required' }, { status: 400 });
    }

    conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);

    // PERBAIKAN: Validasi: Pastikan daerah_id ada di tabel ikt_daerah (bukan daerah)
    // Cek apakah daerah_id valid (bisa berupa string atau number)
    const daerahIdNum = typeof daerah_id === 'string' ? parseInt(daerah_id) : daerah_id;
    if (isNaN(daerahIdNum)) {
      await conn.end();
      return NextResponse.json(
        { success: false, error: `daerah_id ${daerah_id} tidak valid` },
        { status: 400 }
      );
    }
    
    // Pastikan tabel ikt_daerah ada
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS ikt_daerah (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama VARCHAR(255) NOT NULL,
          kode VARCHAR(10) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (err) {
      console.error('[IKT] Error creating ikt_daerah table:', err);
    }
    
    const [daerahCheck] = await conn.execute(
      'SELECT id FROM ikt_daerah WHERE id = ?',
      [daerahIdNum]
    );
    if (!Array.isArray(daerahCheck) || daerahCheck.length === 0) {
      await conn.end();
      return NextResponse.json(
        { success: false, error: `daerah_id ${daerahIdNum} tidak ditemukan di tabel ikt_daerah. Pastikan direktorat IKT sudah ada di sistem.` },
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
      // PERBAIKAN: Pastikan direktorat tidak NULL (gunakan empty string jika NULL)
      // Ini penting untuk unique key yang menyertakan direktorat
      const direktoratValue = it.direktorat ? String(it.direktorat).trim() : '';
      
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
        direktoratValue, // Gunakan empty string jika NULL
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
      console.log(`[ikt-struktur-organisasi/positions] Bulk upload: Deleting old records for daerah ${daerah_id}, periode ${bulanInt}/${tahunInt}`);
      await conn.execute('DELETE FROM struktur_organisasi_ikt WHERE daerah_id = ? AND bulan = ? AND tahun = ?', 
        [daerah_id, bulanInt, tahunInt]);
    } else {
      // PERBAIKAN: Untuk single node update, gunakan UPDATE eksplisit dengan WHERE clause
      // yang mencakup bulan dan tahun untuk memastikan hanya update periode yang dipilih
      // Ini mencegah update ke periode lain
      console.log(`[ikt-struktur-organisasi/positions] Single node update: Using explicit UPDATE with WHERE clause for periode ${bulanInt}/${tahunInt}`);
      const singleValue = values[0];
      const [updateResult]: any = await conn.execute(`
        UPDATE struktur_organisasi_ikt
        SET
          id_posisi_atasan = ?,
          nama = ?,
          jabatan = ?,
          unit_kerja = ?,
          nipp = ?,
          direktorat = ?,
          photo_url = COALESCE(?, photo_url),
          no_hp = ?,
          tmt_jabatan = ?,
          periode_jabatan = ?,
          kj_individu = ?,
          kj_posisi = ?
        WHERE id_posisi_sap = ? 
          AND daerah_id = ? 
          AND direktorat = ? 
          AND bulan = ? 
          AND tahun = ?
      `, [
        singleValue[1], // id_posisi_atasan
        singleValue[3], // nama
        singleValue[4], // jabatan
        singleValue[5], // unit_kerja
        singleValue[6], // nipp
        singleValue[7], // direktorat
        singleValue[8], // photo_url
        singleValue[9], // no_hp
        singleValue[10], // tmt_jabatan
        singleValue[11], // periode_jabatan
        singleValue[12], // kj_individu
        singleValue[13], // kj_posisi
        singleValue[0], // id_posisi_sap (untuk WHERE)
        singleValue[2], // daerah_id (untuk WHERE)
        singleValue[7], // direktorat (untuk WHERE - IKT unique key include direktorat)
        singleValue[14], // bulan (untuk WHERE)
        singleValue[15], // tahun (untuk WHERE)
      ]);
      
      // Jika tidak ada row yang di-update, insert baru
      if (updateResult.affectedRows === 0) {
        console.log(`[ikt-struktur-organisasi/positions] No row updated, inserting new row for periode ${bulanInt}/${tahunInt}`);
        await conn.execute(`
          INSERT INTO struktur_organisasi_ikt
            (id_posisi_sap, id_posisi_atasan, daerah_id, nama, jabatan, unit_kerja, nipp, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, singleValue);
      } else {
        console.log(`[ikt-struktur-organisasi/positions] Updated ${updateResult.affectedRows} row(s) for periode ${bulanInt}/${tahunInt}`);
      }
    }

    // Bulk insert hanya untuk bulk upload
    if (isBulkUpload) {
      const batchSize = 500;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        await conn.execute(`
          INSERT INTO struktur_organisasi_ikt
            (id_posisi_sap, id_posisi_atasan, daerah_id, nama, jabatan, unit_kerja, nipp, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            id_posisi_atasan = VALUES(id_posisi_atasan),
            nama = VALUES(nama),
            jabatan = VALUES(jabatan),
            unit_kerja = VALUES(unit_kerja),
            nipp = VALUES(nipp),
            direktorat = VALUES(direktorat),
            photo_url = COALESCE(VALUES(photo_url), photo_url),
            no_hp = VALUES(no_hp),
            tmt_jabatan = VALUES(tmt_jabatan),
            periode_jabatan = VALUES(periode_jabatan),
            kj_individu = VALUES(kj_individu),
            kj_posisi = VALUES(kj_posisi)
        `, batch.flat());
      }
    }

    await conn.commit();

    return NextResponse.json({ success: true, imported: values.length });
  } catch (error) {
    console.error('POST /api/admin/ikt-struktur-organisasi/positions error', error);
    try { if (conn) await conn.rollback(); } catch {}
    const message = (error as any)?.message || 'Failed to import';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    try { if (conn) await conn.end(); } catch {}
  }
}

