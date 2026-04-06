import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs/promises';

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307

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
        // Excel serial number 1 = 1 Januari 1900
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
            // Untuk konsistensi dengan bulk-upload route, gunakan 30 Desember 1899 sebagai epoch
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
    CREATE TABLE IF NOT EXISTS org_position_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      daerah_id INT NOT NULL,
      id_posisi_sap VARCHAR(64) NOT NULL,
      id_posisi_atasan VARCHAR(64) NULL,
      nama_posisi VARCHAR(255) NULL,
      nama_jabatan_sap VARCHAR(255) NULL,
      unit_kerja VARCHAR(255) NULL,
      nipp VARCHAR(64) NULL,
      nama VARCHAR(255) NULL,
      tingkatan VARCHAR(128) NULL,
      direktorat VARCHAR(255) NULL,
      photo_url VARCHAR(512) NULL,
      bulan INT NULL,
      tahun INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_daerah_id_sap_periode (daerah_id, id_posisi_sap, bulan, tahun),
      KEY idx_daerah (daerah_id),
      KEY idx_periode (bulan, tahun),
      CONSTRAINT fk_org_nodes_daerah FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await conn.execute(ddl);

  // Backfill missing columns for older installations
  const [cols]: any = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'org_position_nodes'`,
    [dbConfig.database]
  );
  const have = new Set((cols as any[]).map((r) => r.COLUMN_NAME.toLowerCase()));

  const alters: string[] = [];
  if (!have.has('tingkatan')) alters.push(`ADD COLUMN tingkatan VARCHAR(128) NULL`);
  if (!have.has('direktorat')) alters.push(`ADD COLUMN direktorat VARCHAR(255) NULL`);
  if (!have.has('photo_url')) alters.push(`ADD COLUMN photo_url VARCHAR(512) NULL`);
  if (!have.has('no_hp')) alters.push(`ADD COLUMN no_hp VARCHAR(64) NULL`);
  if (!have.has('tmt_jabatan')) alters.push(`ADD COLUMN tmt_jabatan DATE NULL`);
  if (!have.has('periode_jabatan')) alters.push(`ADD COLUMN periode_jabatan VARCHAR(128) NULL`);
  if (!have.has('kj_individu')) alters.push(`ADD COLUMN kj_individu VARCHAR(64) NULL`);
  if (!have.has('kj_posisi')) alters.push(`ADD COLUMN kj_posisi VARCHAR(64) NULL`);
  if (!have.has('bulan')) alters.push(`ADD COLUMN bulan INT NULL`);
  if (!have.has('tahun')) alters.push(`ADD COLUMN tahun INT NULL`);

  if (alters.length) {
    await conn.execute(`ALTER TABLE org_position_nodes ${alters.join(', ')}`);
  }

  // Update unique key if bulan and tahun columns were just added
  if (!have.has('bulan') || !have.has('tahun')) {
    try {
      // Drop old unique key if exists
      await conn.execute(`ALTER TABLE org_position_nodes DROP INDEX IF EXISTS uniq_daerah_id_sap`);
      // Add new unique key with periode
      await conn.execute(`ALTER TABLE org_position_nodes ADD UNIQUE KEY uniq_daerah_id_sap_periode (daerah_id, id_posisi_sap, bulan, tahun)`);
      // Add index for periode
      await conn.execute(`ALTER TABLE org_position_nodes ADD INDEX idx_periode (bulan, tahun)`);
    } catch (e: any) {
      // Ignore error if index already exists or doesn't exist
      console.log('Index update skipped:', e.message);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daerahId = searchParams.get('daerah_id');
    const distinct = searchParams.get('distinct');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const directorateParam = searchParams.get("direktorat");
    
    // daerah_id tidak required jika "all" atau tidak ada (untuk "Semua Daerah")
    const isAllDaerah = !daerahId || daerahId === 'all';

    const conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);

    // Build WHERE clause dengan filter periode dan direktorat
    let whereClause = isAllDaerah ? 'WHERE 1=1' : 'WHERE daerah_id = ?';
    const params: any[] = isAllDaerah ? [] : [daerahId];
    
    // Filter by direktorat if provided
    if (directorateParam && directorateParam !== "all" && directorateParam.trim() !== "") {
      whereClause += " AND TRIM(direktorat) = ?";
      params.push(directorateParam.trim());
    }

    if (month && year && month !== 'all' && year !== 'all') {
      // Filter berdasarkan bulan dan tahun spesifik
      const bulanInt = parseInt(month);
      const tahunInt = parseInt(year);
      
      // Cek dulu periode apa saja yang tersedia
      try {
        const periodQuery = isAllDaerah
          ? `SELECT DISTINCT bulan, tahun, COUNT(*) as jumlah
             FROM org_position_nodes 
             WHERE bulan IS NOT NULL AND tahun IS NOT NULL
             GROUP BY bulan, tahun
             ORDER BY tahun DESC, bulan DESC`
          : `SELECT DISTINCT bulan, tahun, COUNT(*) as jumlah
             FROM org_position_nodes 
             WHERE daerah_id = ? AND bulan IS NOT NULL AND tahun IS NOT NULL
             GROUP BY bulan, tahun
             ORDER BY tahun DESC, bulan DESC`;
        
        const [availablePeriods]: any = await conn.execute(
          periodQuery,
          isAllDaerah ? [] : [daerahId]
        );
        if (Array.isArray(availablePeriods) && availablePeriods.length > 0) {
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          console.log(`[org-positions] Available periods for ${daerahLabel}:`, 
            (availablePeriods as any[]).map((p: any) => `${p.bulan}/${p.tahun} (${p.jumlah} nodes)`).join(', '));
        } else {
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          console.log(`[org-positions] No periods found for ${daerahLabel}`);
        }
      } catch (e) {
        console.log('Error checking available periods:', e);
      }
      
      whereClause += ' AND bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
      const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
      console.log(`[org-positions] Filtering by specific period: bulan=${bulanInt}, tahun=${tahunInt} for ${daerahLabel}`);
    } else if (year && month === 'all' && year !== 'all') {
      // Konsolidasi tahunan - semua bulan dalam tahun tersebut
      const tahunInt = parseInt(year);
      whereClause += ' AND tahun = ?';
      params.push(tahunInt);
      console.log(`[org-positions] Filtering by year: tahun=${tahunInt} for daerah_id=${daerahId}`);
    } else {
      // Jika all-all atau tidak ada filter periode, ambil data dengan periode terbaru
      // Cari tahun dan bulan terbaru
      try {
        const latestPeriodQuery = isAllDaerah
          ? `SELECT bulan, tahun FROM org_position_nodes 
             WHERE bulan IS NOT NULL AND tahun IS NOT NULL
             ORDER BY tahun DESC, bulan DESC LIMIT 1`
          : `SELECT bulan, tahun FROM org_position_nodes 
             WHERE daerah_id = ? AND bulan IS NOT NULL AND tahun IS NOT NULL
             ORDER BY tahun DESC, bulan DESC LIMIT 1`;
        
        const [latestPeriod] = await conn.execute(
          latestPeriodQuery,
          isAllDaerah ? [] : [daerahId]
        );
        if (Array.isArray(latestPeriod) && latestPeriod.length > 0) {
          const latest = latestPeriod[0] as any;
          whereClause += ' AND bulan = ? AND tahun = ?';
          params.push(latest.bulan, latest.tahun);
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          console.log(`[org-positions] Using latest period: bulan=${latest.bulan}, tahun=${latest.tahun} for ${daerahLabel}`);
        } else {
          const daerahLabel = isAllDaerah ? 'Semua Daerah' : `daerah_id=${daerahId}`;
          console.log(`[org-positions] No period data found for ${daerahLabel}, fetching all data`);
        }
        // Jika tidak ada data dengan periode, tetap ambil semua data untuk backward compatibility
      } catch (e) {
        // Jika terjadi error (misalnya kolom belum ada), ambil semua data
        console.log('Error fetching latest period, using all data:', e);
      }
    }

    if (distinct === 'direktorat') {
      const [rows] = await conn.execute(
        `SELECT DISTINCT direktorat FROM org_position_nodes 
         ${whereClause} AND direktorat IS NOT NULL AND TRIM(direktorat) <> ''
         ORDER BY direktorat ASC`,
        params
      );
      await conn.end();
      return NextResponse.json({ success: true, data: rows });
    }

    // Query dengan foto persisten: ambil foto dari periode yang sama terlebih dahulu, baru fallback ke periode manapun
    // Pastikan bulan dan tahun di-select untuk validasi
    // PERBAIKAN: Pastikan COALESCE mengambil foto dengan benar, termasuk dari periode yang sama
    const query = `SELECT 
        id, 
        daerah_id, 
        id_posisi_sap, 
        id_posisi_atasan, 
        nama_posisi, 
        nama_jabatan_sap, 
        unit_kerja, 
        nipp, 
        nama, 
        tingkatan, 
        direktorat, 
        COALESCE(
          NULLIF(TRIM(s.photo_url), ''),
          (SELECT TRIM(photo_url)
           FROM org_position_nodes s2
           WHERE s2.id_posisi_sap = s.id_posisi_sap
             AND s2.daerah_id = s.daerah_id
             AND s2.photo_url IS NOT NULL
             AND TRIM(s2.photo_url) != ''
             AND (s2.tahun < s.tahun OR (s2.tahun = s.tahun AND s2.bulan < s.bulan))
           ORDER BY s2.tahun DESC, s2.bulan DESC
           LIMIT 1),
          (SELECT TRIM(photo_url)
           FROM org_position_nodes s3
           WHERE s3.id_posisi_sap = s.id_posisi_sap
             AND s3.daerah_id = s.daerah_id
             AND s3.photo_url IS NOT NULL
             AND TRIM(s3.photo_url) != ''
           ORDER BY s3.tahun DESC, s3.bulan DESC
           LIMIT 1)
        ) as photo_url,
        s.photo_url as photo_url_original,
        s.bulan as bulan,
        s.tahun as tahun,
        no_hp, 
        tmt_jabatan, 
        periode_jabatan, 
        kj_individu, 
        kj_posisi
       FROM org_position_nodes s ${whereClause} ORDER BY id ASC`;
    
    console.log(`[org-positions] Executing query with params:`, params);
    console.log(`[org-positions] Query:`, query.replace(/\s+/g, ' ').substring(0, 500));
    const [rows] = await conn.execute(query, params);
    
    // Log untuk debugging - cek apakah ada photo_url di hasil query
    const rowsArray = rows as any[];
    if (rowsArray.length > 0) {
      const sampleRow = rowsArray[0];
      console.log(`[org-positions] Sample row from query:`, {
        id_posisi_sap: sampleRow.id_posisi_sap,
        nama: sampleRow.nama,
        photo_url: sampleRow.photo_url,
        photo_url_original: sampleRow.photo_url_original,
        no_hp: sampleRow.no_hp,
        tingkatan: sampleRow.tingkatan,
        direktorat: sampleRow.direktorat,
        kj_individu: sampleRow.kj_individu,
        kj_posisi: sampleRow.kj_posisi,
        bulan: sampleRow.bulan,
        tahun: sampleRow.tahun,
      });
      
      const rowsWithPhoto = rowsArray.filter(r => r.photo_url && r.photo_url.trim() !== '');
      console.log(`[org-positions] Rows with photo_url: ${rowsWithPhoto.length}/${rowsArray.length}`);
      if (rowsWithPhoto.length > 0) {
        console.log(`[org-positions] Sample rows with photo:`, rowsWithPhoto.slice(0, 3).map((r: any) => ({
          id_posisi_sap: r.id_posisi_sap,
          nama: r.nama,
          photo_url: r.photo_url,
        })));
      } else {
        console.warn(`[org-positions] WARNING: No photo_url found in query results! All ${rowsArray.length} rows have null/empty photo_url`);
      }
    }
    
    // Log foto yang ditemukan untuk debugging (detailed)
    const nodesWithPhoto = rowsArray.filter(r => r.photo_url && r.photo_url.trim() !== '');
    const nodesWithOriginalPhoto = rowsArray.filter(r => r.photo_url_original && r.photo_url_original.trim() !== '');
    const nodesWithoutPhoto = rowsArray.filter(r => !r.photo_url || r.photo_url.trim() === '');
    console.log(`[org-positions] Nodes with photo (including from previous period): ${nodesWithPhoto.length}/${rowsArray.length}`);
    console.log(`[org-positions] Nodes with original photo (current period): ${nodesWithOriginalPhoto.length}/${rowsArray.length}`);
    console.log(`[org-positions] Nodes without photo: ${nodesWithoutPhoto.length}/${rowsArray.length}`);
    
    // Log sample foto untuk debugging
    if (nodesWithPhoto.length > 0) {
      console.log(`[org-positions] Sample nodes with photo:`, nodesWithPhoto.slice(0, 5).map((r: any) => ({
        id_posisi_sap: r.id_posisi_sap,
        nama: r.nama,
        photo_url: r.photo_url,
        photo_url_original: r.photo_url_original,
        bulan: r.bulan,
        tahun: r.tahun
      })));
    }
    
    // Debug: Cek apakah ada foto di database untuk periode yang diminta
    if (rowsArray.length > 0 && month && year && month !== 'all' && year !== 'all') {
      const bulanInt = parseInt(month);
      const tahunInt = parseInt(year);
      try {
        // PERBAIKAN: Handle daerah_id=all dengan query yang berbeda
        const photoCheckQuery = isAllDaerah
          ? `SELECT id_posisi_sap, photo_url, bulan, tahun, daerah_id 
             FROM org_position_nodes 
             WHERE bulan = ? AND tahun = ? AND photo_url IS NOT NULL AND photo_url != ''
             LIMIT 10`
          : `SELECT id_posisi_sap, photo_url, bulan, tahun, daerah_id 
             FROM org_position_nodes 
             WHERE daerah_id = ? AND bulan = ? AND tahun = ? AND photo_url IS NOT NULL AND photo_url != ''
             LIMIT 10`;
        const photoCheckParams = isAllDaerah ? [bulanInt, tahunInt] : [daerahId, bulanInt, tahunInt];
        
        const [photoCheck]: any = await conn.execute(photoCheckQuery, photoCheckParams);
        if (Array.isArray(photoCheck) && photoCheck.length > 0) {
          console.log(`[org-positions] Found ${photoCheck.length} nodes with photos in database for period ${bulanInt}/${tahunInt}:`, 
            photoCheck.map((p: any) => ({
              id_posisi_sap: p.id_posisi_sap,
              photo_url: p.photo_url,
              bulan: p.bulan,
              tahun: p.tahun,
              daerah_id: p.daerah_id
            })));
        } else {
          const daerahLabel = isAllDaerah ? 'all' : daerahId;
          console.log(`[org-positions] No photos found in database for period ${bulanInt}/${tahunInt}, daerah_id=${daerahLabel}`);
        }
      } catch (e) {
        console.error('Error checking photos in database:', e);
      }
    }
    
    if (nodesWithPhoto.length > 0) {
      // Cek apakah file foto benar-benar ada di filesystem
      const photoChecks = await Promise.all(
        nodesWithPhoto.slice(0, 5).map(async (r) => {
          const photoPath = r.photo_url;
          if (photoPath && photoPath.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', photoPath);
            try {
              await fs.access(filePath);
              return { ...r, fileExists: true };
            } catch {
              return { ...r, fileExists: false };
            }
          }
          return { ...r, fileExists: null };
        })
      );
      
      console.log(`[org-positions] Sample photos with file check:`, photoChecks.map(r => ({
        id_posisi_sap: r.id_posisi_sap,
        nama: r.nama,
        photo_url: r.photo_url,
        photo_url_original: r.photo_url_original,
        bulan: r.bulan,
        tahun: r.tahun,
        daerah_id: r.daerah_id,
        fileExists: r.fileExists
      })));
    }
    if (nodesWithoutPhoto.length > 0 && nodesWithoutPhoto.length <= 10) {
      console.log(`[org-positions] Nodes without photo:`, nodesWithoutPhoto.map(r => ({
        id_posisi_sap: r.id_posisi_sap,
        nama: r.nama,
        bulan: r.bulan,
        tahun: r.tahun,
        daerah_id: r.daerah_id
      })));
    }
    
    // Log untuk debugging: cek apakah ada node dengan id_posisi_atasan = null
    const rootNodes = rowsArray.filter(r => !r.id_posisi_atasan || r.id_posisi_atasan.trim() === '');
    
    // Log period info dari data yang di-fetch
    const periodsInData = new Set(rowsArray.map(r => `${r.bulan}-${r.tahun}`));
    console.log(`[org-positions] Total nodes fetched: ${rowsArray.length} for daerah_id=${daerahId}, requested period=${month}/${year}`);
    console.log(`[org-positions] Periods in fetched data: ${Array.from(periodsInData).join(', ') || 'NONE'}`);
    
    // Jika tidak ada data dan periode spesifik diminta, beri warning
    if (rowsArray.length === 0 && month && year && month !== 'all' && year !== 'all') {
      console.warn(`[org-positions] WARNING: No data found for daerah_id=${daerahId}, period=${month}/${year}`);
      // Cek periode yang tersedia untuk memberikan saran
      try {
        const [availablePeriods]: any = await conn.execute(
          `SELECT DISTINCT bulan, tahun, COUNT(*) as jumlah
           FROM org_position_nodes 
           WHERE daerah_id = ? AND bulan IS NOT NULL AND tahun IS NOT NULL
           GROUP BY bulan, tahun
           ORDER BY tahun DESC, bulan DESC
           LIMIT 5`,
          [daerahId]
        );
        if (Array.isArray(availablePeriods) && availablePeriods.length > 0) {
          const periodList = (availablePeriods as any[]).map((p: any) => `${p.bulan}/${p.tahun}`).join(', ');
          console.warn(`[org-positions] Available periods for daerah_id=${daerahId}: ${periodList}`);
        }
      } catch (e) {
        // Ignore error
      }
    }
    
    if (rootNodes.length > 0) {
      console.log(`[org-positions] Found ${rootNodes.length} root nodes (without atasan):`, 
        rootNodes.map(r => `${r.id_posisi_sap} (${r.nama || 'N/A'})`).join(', '));
    }
    
    await conn.end();

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('GET /api/admin/org-positions error', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
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
      console.log(`[org-positions] POST - Received request for single node:`, {
        id_posisi_sap: items[0].id_posisi_sap,
        photo_url: items[0].photo_url || 'NULL/EMPTY',
        nama: items[0].nama,
        bulan,
        tahun
      });
    }

    // Validasi: Pastikan daerah_id ada di tabel daerah
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
      'SELECT id FROM daerah WHERE id = ?',
      [daerahIdNum]
    );
    if (!Array.isArray(daerahCheck) || daerahCheck.length === 0) {
      await conn.end();
      return NextResponse.json(
        { success: false, error: `daerah_id ${daerahIdNum} tidak ditemukan di tabel daerah. Pastikan daerah sudah ada di sistem.` },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    const values: any[] = [];
    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    for (const it of items) {
      const sap = String(it.id_posisi_sap || '').trim();
      if (!sap) continue;
      
      // Log untuk debugging single node update
      if (items.length === 1) {
        console.log(`[org-positions] POST - Single node update received:`, {
          id_posisi_sap: sap,
          nama: it.nama,
          tingkatan: it.tingkatan,
          direktorat: it.direktorat,
          photo_url: it.photo_url,
          no_hp: it.no_hp,
          kj_individu: it.kj_individu,
          kj_posisi: it.kj_posisi,
          bulan: bulanInt,
          tahun: tahunInt,
        });
      }
      
      // PERBAIKAN: Pastikan bulan dan tahun selalu ada (tidak NULL)
      // Gunakan bulan dan tahun dari request body, bukan dari item (jika ada)
      const itemBulan = it.bulan !== undefined && it.bulan !== null ? parseInt(String(it.bulan)) : bulanInt;
      const itemTahun = it.tahun !== undefined && it.tahun !== null ? parseInt(String(it.tahun)) : tahunInt;
      
      // Pastikan tidak NULL
      const finalBulan = isNaN(itemBulan) ? bulanInt : itemBulan;
      const finalTahun = isNaN(itemTahun) ? tahunInt : itemTahun;
      
      values.push([
        daerahIdNum,  // PERBAIKAN: Gunakan daerahIdNum yang sudah di-parse, bukan daerah_id
        sap,
        it.id_posisi_atasan ? String(it.id_posisi_atasan).trim() : null,
        it.nama_posisi ?? null,
        it.nama_jabatan_sap ?? null,
        it.unit_kerja ?? null,
        it.nipp ?? null,
        it.nama ?? null,
        it.tingkatan ?? null,
        it.direktorat ?? null,
        it.photo_url ?? null,
        it.no_hp ?? null,
        formatDateForMySQL(it.tmt_jabatan),
        it.periode_jabatan ?? null,
        it.kj_individu ?? null,
        it.kj_posisi ?? null,
        finalBulan,  // Gunakan finalBulan yang sudah dipastikan tidak NULL
        finalTahun,  // Gunakan finalTahun yang sudah dipastikan tidak NULL
      ]);
    }

    if (values.length === 0) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'No valid items to import' }, { status: 400 });
    }

    // PERBAIKAN: Hanya hapus data jika menyimpan banyak items (bulk upload)
    // Jika hanya menyimpan satu node (edit individual), gunakan UPDATE eksplisit dengan WHERE clause
    // yang mencakup bulan dan tahun untuk memastikan hanya update periode yang dipilih
    const isBulkUpload = values.length > 1;
    
    if (isBulkUpload) {
      // Untuk bulk upload, hapus data lama untuk daerah dan periode ini sebelum insert baru
      console.log(`[org-positions] Bulk upload: Deleting ${values.length} old records for daerah ${daerahIdNum}, periode ${bulanInt}/${tahunInt}`);
      await conn.execute('DELETE FROM org_position_nodes WHERE daerah_id = ? AND bulan = ? AND tahun = ?', 
        [daerahIdNum, bulanInt, tahunInt]);  // PERBAIKAN: Gunakan daerahIdNum yang sudah di-parse
      
      // Bulk insert dengan ON DUPLICATE KEY UPDATE
      const batchSize = 500;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        await conn.execute(`
          INSERT INTO org_position_nodes
            (daerah_id, id_posisi_sap, id_posisi_atasan, nama_posisi, nama_jabatan_sap, unit_kerja, nipp, nama, tingkatan, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            id_posisi_atasan = COALESCE(NULLIF(VALUES(id_posisi_atasan), ''), id_posisi_atasan),
            nama_posisi = COALESCE(NULLIF(VALUES(nama_posisi), ''), nama_posisi),
            nama_jabatan_sap = COALESCE(NULLIF(VALUES(nama_jabatan_sap), ''), nama_jabatan_sap),
            unit_kerja = COALESCE(NULLIF(VALUES(unit_kerja), ''), unit_kerja),
            nipp = COALESCE(NULLIF(VALUES(nipp), ''), nipp),
            nama = COALESCE(NULLIF(VALUES(nama), ''), nama),
            tingkatan = COALESCE(NULLIF(VALUES(tingkatan), ''), tingkatan),
            direktorat = COALESCE(NULLIF(VALUES(direktorat), ''), direktorat),
            photo_url = CASE 
              WHEN VALUES(photo_url) IS NOT NULL AND TRIM(VALUES(photo_url)) != '' 
              THEN VALUES(photo_url) 
              ELSE photo_url 
            END,
            no_hp = COALESCE(NULLIF(VALUES(no_hp), ''), no_hp),
            tmt_jabatan = COALESCE(VALUES(tmt_jabatan), tmt_jabatan),
            periode_jabatan = COALESCE(NULLIF(VALUES(periode_jabatan), ''), periode_jabatan),
            kj_individu = COALESCE(NULLIF(VALUES(kj_individu), ''), kj_individu),
            kj_posisi = COALESCE(NULLIF(VALUES(kj_posisi), ''), kj_posisi)
        `, batch.flat());
      }
    } else {
      // PERBAIKAN: Untuk single node update, gunakan UPDATE eksplisit dengan WHERE clause
      // yang mencakup bulan dan tahun untuk memastikan hanya update periode yang dipilih
      // Ini mencegah update ke periode lain
      console.log(`[org-positions] Single node update: Using explicit UPDATE with WHERE clause for periode ${bulanInt}/${tahunInt}`);
      const singleValue = values[0];
      const [updateResult]: any = await conn.execute(`
        UPDATE org_position_nodes
        SET
          id_posisi_atasan = ?,
          nama_posisi = ?,
          nama_jabatan_sap = ?,
          unit_kerja = ?,
          nipp = ?,
          nama = ?,
          tingkatan = ?,
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
        WHERE daerah_id = ? 
          AND id_posisi_sap = ? 
          AND bulan = ? 
          AND tahun = ?
      `, [
        singleValue[2], // id_posisi_atasan
        singleValue[3], // nama_posisi
        singleValue[4], // nama_jabatan_sap
        singleValue[5], // unit_kerja
        singleValue[6], // nipp
        singleValue[7], // nama
        singleValue[8], // tingkatan
        singleValue[9], // direktorat
        singleValue[10], singleValue[10], singleValue[10], // photo_url (3x untuk CASE)
        singleValue[11], // no_hp
        singleValue[12], // tmt_jabatan
        singleValue[13], // periode_jabatan
        singleValue[14], // kj_individu
        singleValue[15], // kj_posisi
        singleValue[0], // daerah_id (untuk WHERE)
        singleValue[1], // id_posisi_sap (untuk WHERE)
        singleValue[16], // bulan (untuk WHERE)
        singleValue[17], // tahun (untuk WHERE)
      ]);
      
      // Jika tidak ada row yang di-update, insert baru
      if (updateResult.affectedRows === 0) {
        console.log(`[org-positions] No row updated, inserting new row for periode ${bulanInt}/${tahunInt}`);
        await conn.execute(`
          INSERT INTO org_position_nodes
            (daerah_id, id_posisi_sap, id_posisi_atasan, nama_posisi, nama_jabatan_sap, unit_kerja, nipp, nama, tingkatan, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, singleValue);
      } else {
        console.log(`[org-positions] Updated ${updateResult.affectedRows} row(s) for periode ${bulanInt}/${tahunInt}`);
      }
    }

    // PERBAIKAN: Verifikasi data yang tersimpan setelah INSERT/UPDATE
    if (values.length === 1) {
      try {
        const singleValue = values[0];
        const [verifyRows]: any = await conn.execute(
          `SELECT id_posisi_sap, nama, tingkatan, direktorat, photo_url, no_hp, kj_individu, kj_posisi, bulan, tahun
           FROM org_position_nodes 
           WHERE daerah_id = ? AND id_posisi_sap = ? AND bulan = ? AND tahun = ?`,
          [daerah_id, singleValue[1], bulanInt, tahunInt]
        );
        
        if (Array.isArray(verifyRows) && verifyRows.length > 0) {
          const savedData = verifyRows[0];
          console.log(`[org-positions] POST - Verification after save:`, {
            id_posisi_sap: savedData.id_posisi_sap,
            nama: savedData.nama,
            tingkatan: savedData.tingkatan || 'NULL',
            direktorat: savedData.direktorat || 'NULL',
            photo_url: savedData.photo_url || 'NULL',
            no_hp: savedData.no_hp || 'NULL',
            kj_individu: savedData.kj_individu || 'NULL',
            kj_posisi: savedData.kj_posisi || 'NULL',
            bulan: savedData.bulan,
            tahun: savedData.tahun,
          });
          
          // Warning jika field penting hilang
          if (!savedData.tingkatan && !savedData.direktorat && !savedData.no_hp && !savedData.kj_individu && !savedData.kj_posisi && !savedData.photo_url) {
            console.warn(`[org-positions] POST - WARNING: All important fields are NULL after save!`);
          }
        } else {
          console.error(`[org-positions] POST - ERROR: Data not found after save!`);
        }
      } catch (err) {
        console.error(`[org-positions] POST - Error verifying saved data:`, err);
      }
    }

    // Update foto dari periode sebelumnya untuk row yang photo_url NULL (menggunakan JOIN)
    await conn.execute(`
      UPDATE org_position_nodes s
      INNER JOIN (
        SELECT 
          s2.nipp,
          s2.daerah_id,
          s2.photo_url,
          ROW_NUMBER() OVER (PARTITION BY s2.nipp, s2.daerah_id ORDER BY s2.tahun DESC, s2.bulan DESC) as rn
        FROM org_position_nodes s2
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
      UPDATE org_position_nodes s
      INNER JOIN (
        SELECT 
          s2.id_posisi_sap,
          s2.daerah_id,
          s2.photo_url,
          ROW_NUMBER() OVER (PARTITION BY s2.id_posisi_sap, s2.daerah_id ORDER BY s2.tahun DESC, s2.bulan DESC) as rn
        FROM org_position_nodes s2
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

    return NextResponse.json({ success: true, imported: values.length });
  } catch (error) {
    console.error('POST /api/admin/org-positions error', error);
    try { if (conn) await conn.rollback(); } catch {}
    const message = (error as any)?.message || 'Failed to import';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    try { if (conn) await conn.end(); } catch {}
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, daerah_id, id_posisi_sap, id_posisi_atasan, nama_posisi, nama_jabatan_sap, unit_kerja, nipp, nama, tingkatan, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi } = body || {};

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const conn = await mysql.createConnection(dbConfig);
    await ensureTable(conn);
    
    // Validasi: Jika daerah_id diberikan, pastikan ada di tabel daerah
    if (daerah_id !== null && daerah_id !== undefined) {
      const [daerahCheck] = await conn.execute(
        'SELECT id FROM daerah WHERE id = ?',
        [daerah_id]
      );
      if (!Array.isArray(daerahCheck) || daerahCheck.length === 0) {
        await conn.end();
        return NextResponse.json(
          { success: false, error: `daerah_id ${daerah_id} tidak ditemukan di tabel daerah` },
          { status: 400 }
        );
      }
    }
    
    const [result] = await conn.execute(
      `UPDATE org_position_nodes SET
        daerah_id = COALESCE(?, daerah_id),
        id_posisi_sap = COALESCE(?, id_posisi_sap),
        id_posisi_atasan = ?,
        nama_posisi = ?,
        nama_jabatan_sap = ?,
        unit_kerja = ?,
        nipp = ?,
        nama = ?,
        tingkatan = ?,
        direktorat = ?,
        photo_url = ?,
        no_hp = ?,
        tmt_jabatan = ?,
        periode_jabatan = ?,
        kj_individu = ?,
        kj_posisi = ?
      WHERE id = ?`,
      [
        daerah_id ?? null,
        id_posisi_sap ?? null,
        id_posisi_atasan ?? null,
        nama_posisi ?? null,
        nama_jabatan_sap ?? null,
        unit_kerja ?? null,
        nipp ?? null,
        nama ?? null,
        tingkatan ?? null,
        direktorat ?? null,
        photo_url ?? null,
        no_hp ?? null,
        formatDateForMySQL(tmt_jabatan),
        periode_jabatan ?? null,
        kj_individu ?? null,
        kj_posisi ?? null,
        id,
      ]
    );
    await conn.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/org-positions error', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}