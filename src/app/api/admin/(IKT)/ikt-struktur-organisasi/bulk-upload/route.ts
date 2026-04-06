import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { read, utils } from 'xlsx';

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

// Helper function untuk normalize nilai
function normalizeValue(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  return str && str !== '-' ? str : null;
}

// Helper function untuk mengambil field dari row dengan berbagai variasi nama kolom (case-insensitive)
function getFieldFromRow(row: any, variants: string[]): string | null {
  for (const variant of variants) {
    // Cari dengan exact match dulu
    if (row[variant] !== undefined && row[variant] !== null) {
      const value = String(row[variant]).trim();
      if (value && value !== '-') {
        return value;
      }
    }
    // Cari dengan case-insensitive
    const rowKeys = Object.keys(row);
    const foundKey = rowKeys.find(k => k.toUpperCase().trim() === variant.toUpperCase().trim());
    if (foundKey) {
      const value = String(row[foundKey]).trim();
      if (value && value !== '-') {
        return value;
      }
    }
  }
  return null;
}

// Deteksi kolom DAERAH dengan variasi nama
function detectDaerahColumn(headers: string[]): string | null {
  const daerahVariants = ['DAERAH', 'DAERAH_ID', 'KODE DAERAH', 'NAMA DAERAH', 'KODE_DAERAH', 'NAMA_DAERAH'];
  for (const variant of daerahVariants) {
    if (headers.includes(variant)) {
      return variant;
    }
  }
  return null;
}

// Deteksi kolom BULAN dan TAHUN
function detectPeriodColumns(headers: string[]): { bulan: string | null; tahun: string | null } {
  let bulanCol: string | null = null;
  let tahunCol: string | null = null;
  
  const bulanVariants = ['BULAN', 'BULAN_PERIODE', 'MONTH'];
  const tahunVariants = ['TAHUN', 'TAHUN_PERIODE', 'YEAR'];
  
  for (const variant of bulanVariants) {
    if (headers.includes(variant)) {
      bulanCol = variant;
      break;
    }
  }
  
  for (const variant of tahunVariants) {
    if (headers.includes(variant)) {
      tahunCol = variant;
      break;
    }
  }
  
  return { bulan: bulanCol, tahun: tahunCol };
}

function detectDirektoratColumn(headers: string[]): string | null {
  const variants = ['DIREKTORAT', 'DIRECTORATE', 'DIVISI', 'DIVISION', 'DEPARTMENT'];
  // Case-insensitive search
  for (const variant of variants) {
    const found = headers.find(h => h.toUpperCase().trim() === variant.toUpperCase().trim());
    if (found) {
      return found; // Return original header name (preserve case)
    }
  }
  return null;
}

function generateDirektoratKode(name: string, existingCodes: Set<string>): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  let base = words.map((w) => w[0]).join('');
  if (!base) {
    base = 'DIR';
  }
  base = base.slice(0, 4);
  let attempt = 0;
  let candidate = base || 'DIR';
  while (existingCodes.has(candidate)) {
    attempt += 1;
    candidate = `${base}${attempt}`.slice(0, 6);
    if (!candidate) {
      candidate = `DIR${attempt}`;
    }
  }
  existingCodes.add(candidate);
  return candidate;
}

// PERBAIKAN: Buat fungsi ensureDirektoratDaerah untuk IKT menggunakan tabel ikt_daerah
async function ensureDirektoratDaerah(
  conn: mysql.Connection,
  direktoratName: string,
  daerahRows: any[],
  daerahMap: Map<string, number>,
  daerahNameMap: Map<string, number>,
  existingCodes: Set<string>
): Promise<number | null> {
  const cleanName = (direktoratName || '').trim();
  if (!cleanName) {
    return null;
  }

  const upperName = cleanName.toUpperCase();
  
  // PERBAIKAN: Untuk IKT, gunakan tabel ikt_daerah (bukan ptp_daerah)
  // Cek apakah tabel ikt_daerah ada, jika tidak buat
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
  
  const [existing]: any = await conn.execute(
    'SELECT id, kode FROM ikt_daerah WHERE UPPER(nama) = ? LIMIT 1',
    [upperName]
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id;
    const kode = existing[0].kode;
    if (!daerahRows.some((row) => row.id === id)) {
      daerahRows.push({ id, nama: cleanName, kode });
    }
    const kodeKey = String(kode || '').trim().toUpperCase();
    if (kodeKey) {
      daerahMap.set(kodeKey, id);
    }
    const namaUpper = cleanName.toUpperCase().trim();
    const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, '');
    daerahNameMap.set(namaUpper, id);
    daerahNameMap.set(namaUpper.replace(/\s+/g, ' '), id);
    daerahNameMap.set(namaNormalized, id);
    daerahNameMap.set(namaUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), id);
    daerahNameMap.set(namaNormalized.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), id);
    return id;
  }

  const kodeBaru = generateDirektoratKode(cleanName, existingCodes);
  const [result]: any = await conn.execute(
    'INSERT INTO ikt_daerah (nama, kode) VALUES (?, ?)',
    [cleanName, kodeBaru]
  );
  const newId = result?.insertId;
  if (!newId) {
    return null;
  }

  const namaUpper = cleanName.toUpperCase().trim();
  const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, '');
  daerahRows.push({ id: newId, nama: cleanName, kode: kodeBaru });
  daerahMap.set(kodeBaru.toUpperCase(), newId);
  daerahNameMap.set(namaUpper, newId);
  daerahNameMap.set(namaUpper.replace(/\s+/g, ' '), newId);
  daerahNameMap.set(namaNormalized, newId);
  daerahNameMap.set(namaUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), newId);
  daerahNameMap.set(namaNormalized.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), newId);
  return newId;
}

// Validasi circular reference
function validateHierarchy(rows: any[], daerahId: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sapSet = new Set<string>();
  const parentMap = new Map<string, string>();
  
  // Build map
  for (const row of rows) {
    const sap = String(row["ID POSISI SAP"] || '').trim();
    if (!sap) continue;
    
    sapSet.add(sap);
    const atasan = row["ID POSISI ATASAN"] ? String(row["ID POSISI ATASAN"]).trim() : null;
    if (atasan) {
      parentMap.set(sap, atasan);
    }
  }
  
  // Check circular reference
  for (const [sap, atasan] of parentMap.entries()) {
    const visited = new Set<string>();
    let current: string | null = atasan;
    
    while (current) {
      if (visited.has(current)) {
        errors.push(`Circular reference detected: ${sap} -> ${atasan}`);
        return { valid: false, errors };
      }
      visited.add(current);
      
      if (current === sap) {
        errors.push(`Circular reference detected: ${sap} references itself`);
        return { valid: false, errors };
      }
      
      current = parentMap.get(current) || null;
    }
  }
  
  // Check if all ID POSISI ATASAN exist in the same daerah
  for (const [sap, atasan] of parentMap.entries()) {
    if (!sapSet.has(atasan)) {
      // Cari nama posisi untuk error message yang lebih informatif
      const sapRow = rows.find(r => String(r["ID POSISI SAP"] || '').trim() === sap);
      const sapNama = sapRow ? (sapRow["NAMA"] || sapRow["nama"] || sap) : sap;
      
      errors.push(`ID POSISI ATASAN "${atasan}" untuk posisi "${sap}" (${sapNama}) tidak ditemukan di data Excel. Pastikan ID POSISI ATASAN "${atasan}" ada di kolom "ID POSISI SAP" dalam file Excel yang sama.`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Get photo from previous period
async function getPhotoFromPreviousPeriod(
  conn: mysql.Connection,
  nipp: string | null,
  idPosisiSap: string,
  daerahId: number,
  bulan: number,
  tahun: number
): Promise<string | null> {
  if (!nipp && !idPosisiSap) return null;
  
  try {
    let query = `
      SELECT photo_url 
      FROM struktur_organisasi_ikt
      WHERE daerah_id = ? AND photo_url IS NOT NULL
        AND (tahun < ? OR (tahun = ? AND bulan < ?))
    `;
    const params: any[] = [daerahId, tahun, tahun, bulan];
    
    if (nipp) {
      query += ` AND nipp = ?`;
      params.push(nipp);
      query += ` ORDER BY tahun DESC, bulan DESC LIMIT 1`;
    } else {
      query += ` AND id_posisi_sap = ?`;
      params.push(idPosisiSap);
      query += ` ORDER BY tahun DESC, bulan DESC LIMIT 1`;
    }
    
    const [rows]: any = await conn.execute(query, params);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0].photo_url;
    }
  } catch (error) {
    console.error('Error fetching photo from previous period:', error);
  }
  
  return null;
}

// Helper function untuk mapping daerah dengan format fleksibel
function findDaerahId(
  daerahValue: string,
  daerahMap: Map<string, number>,
  daerahNameMap: Map<string, number>,
  daerahRows: any[]
): number | null {
  if (!daerahValue || !daerahValue.trim()) {
    return null;
  }
  
  // Normalize input: trim, uppercase, replace multiple spaces, remove special chars, normalize dash
  const normalize = (str: string) => {
    return str.toUpperCase()
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s-]/g, '') // Remove special chars except dash and space
      .replace(/-/g, '') // Remove dash untuk matching (Pare-Pare = Parepare)
      .trim();
  };
  
  const daerahUpper = normalize(daerahValue);
  
  // 1. Direct match dengan kode (case-insensitive, normalized)
  const kodeNormalized = normalize(daerahValue);
  for (const [kode, id] of daerahMap.entries()) {
    if (normalize(kode) === kodeNormalized) {
      return id;
    }
  }
  
  // 2. Direct match dengan nama lengkap (dengan prefix SPMT/PTP/IKT)
  const namaNormalized = normalize(daerahValue);
  for (const [nama, id] of daerahNameMap.entries()) {
    if (normalize(nama) === namaNormalized) {
      return id;
    }
  }
  
  // 3. Match dengan normalisasi spasi (handle multiple spaces, tabs, etc)
  for (const row of daerahRows) {
    const dbNama = normalize(String(row.nama || ''));
    if (dbNama === daerahUpper) {
      return row.id;
    }
  }
  
  // 4. Match nama tanpa prefix "SPMT" atau "PTP" atau "IKT" (contoh: "Belawan" -> "IKT Belawan")
  const namaWithoutPrefix = daerahUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
  if (namaWithoutPrefix.length > 0) {
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
      
      // Match exact tanpa prefix
      if (dbNamaWithoutPrefix === namaWithoutPrefix) {
        return row.id;
      }
      
      // Match jika nama tanpa prefix sama (dengan normalisasi)
      if (normalize(dbNamaWithoutPrefix) === normalize(namaWithoutPrefix)) {
        return row.id;
      }
    }
  }
  
  // 5. Match format "Regional X - Nama" -> extract nama
  const regionalMatch = daerahUpper.match(/^REGIONAL\s+\d+\s*-\s*(.+)$/);
  if (regionalMatch) {
    const namaDaerah = normalize(regionalMatch[1].trim());
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
      
      if (normalize(dbNamaWithoutPrefix) === namaDaerah || dbNama.includes(namaDaerah)) {
        return row.id;
      }
    }
  }
  
  // 6. Fuzzy match - cari nama yang mengandung kata kunci utama (lebih toleran)
  const keywords = daerahUpper.split(/\s+/).filter(k => k.length > 2 && k !== 'SPMT' && k !== 'PTP' && k !== 'IKT');
  if (keywords.length > 0) {
    // Ambil keyword terpanjang sebagai primary keyword
    const primaryKeyword = keywords.sort((a, b) => b.length - a.length)[0];
    
    // Score-based matching: cari yang paling cocok
    let bestMatch: { id: number; score: number } | null = null;
    
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbKode = normalize(String(row.kode || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
      
      let score = 0;
      
      // Jika primary keyword ada di nama atau kode
      if (dbNama.includes(primaryKeyword) || dbKode.includes(primaryKeyword)) {
        score += 10;
        
        // Check berapa banyak keyword yang match
        const matchedKeywords = keywords.filter(keyword => 
          dbNama.includes(keyword) || dbKode.includes(keyword) || dbNamaWithoutPrefix.includes(keyword)
        );
        score += matchedKeywords.length * 5;
        
        // Bonus jika semua keyword match
        if (matchedKeywords.length === keywords.length) {
          score += 20;
        }
        
        // Bonus jika nama tanpa prefix match
        if (normalize(dbNamaWithoutPrefix) === normalize(namaWithoutPrefix)) {
          score += 30;
        }
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: row.id, score };
      }
    }
    
    // Jika score cukup tinggi (minimal 15), return match terbaik
    if (bestMatch && bestMatch.score >= 15) {
      return bestMatch.id;
    }
  }
  
  // 7. Levenshtein-like matching untuk typo tolerance (simple version)
  // Cari nama yang paling mirip (minimal 70% karakter sama)
  if (daerahUpper.length > 3) {
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
      
      // Simple similarity check: hitung berapa banyak karakter yang sama
      const inputChars = new Set(daerahUpper.split(''));
      const dbChars = new Set(dbNama.split(''));
      const dbCharsNoPrefix = new Set(dbNamaWithoutPrefix.split(''));
      
      const similarity1 = Array.from(inputChars).filter(c => dbChars.has(c)).length / Math.max(inputChars.size, dbChars.size);
      const similarity2 = Array.from(inputChars).filter(c => dbCharsNoPrefix.has(c)).length / Math.max(inputChars.size, dbCharsNoPrefix.size);
      
      if (similarity1 > 0.7 || similarity2 > 0.7) {
        return row.id;
      }
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  let conn: mysql.Connection | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bulanForm = formData.get('bulan') as string;
    const tahunForm = formData.get('tahun') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File Excel wajib diisi' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: 'File harus bertipe .xlsx atau .xls' },
        { status: 400 }
      );
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<any>(sheet, { defval: null });

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File Excel kosong atau tidak valid' },
        { status: 400 }
      );
    }

    // Get headers
    const headers = Object.keys(data[0] || {});
    
    // PERBAIKAN: Prioritas kolom DIREKTORAT untuk IKT (sama seperti PTP)
    // Untuk IKT, kolom DIREKTORAT digunakan untuk mapping ke ikt_daerah
    const direktoratColumn = detectDirektoratColumn(headers);
    const daerahColumn = detectDaerahColumn(headers);
    let usingDirektoratFallback = false;
    let daerahColumnName: string;
    
    // Prioritas 1: Gunakan DIREKTORAT jika ada (untuk IKT)
    if (direktoratColumn) {
      daerahColumnName = direktoratColumn;
      usingDirektoratFallback = true;
      console.log('[IKT Bulk Upload] Using DIREKTORAT column for mapping to ikt_daerah.');
    } else if (daerahColumn) {
      // Prioritas 2: Gunakan DAERAH jika DIREKTORAT tidak ada
      daerahColumnName = daerahColumn;
      usingDirektoratFallback = false;
      console.log('[IKT Bulk Upload] DIREKTORAT column not found. Using DAERAH column.');
    } else {
      // Error jika kedua kolom tidak ditemukan
      return NextResponse.json(
        { success: false, error: 'Kolom DIREKTORAT atau DAERAH tidak ditemukan. Untuk IKT, pastikan file Excel memiliki kolom "DIREKTORAT" untuk mapping ke ikt_daerah.' },
        { status: 400 }
      );
    }

    // Deteksi kolom BULAN dan TAHUN
    const { bulan: bulanCol, tahun: tahunCol } = detectPeriodColumns(headers);
    const hasPeriodInExcel = bulanCol && tahunCol;

    // Validasi bulan dan tahun dari form jika tidak ada di Excel
    let bulanDefault: number | null = null;
    let tahunDefault: number | null = null;
    
    if (!hasPeriodInExcel) {
      if (!bulanForm || !tahunForm || bulanForm === 'all' || tahunForm === 'all') {
        return NextResponse.json(
          { success: false, error: 'Bulan dan tahun wajib diisi (dari form atau kolom Excel)' },
          { status: 400 }
        );
      }
      bulanDefault = parseInt(bulanForm);
      tahunDefault = parseInt(tahunForm);
      
      if (isNaN(bulanDefault) || isNaN(tahunDefault) || bulanDefault < 1 || bulanDefault > 12) {
        return NextResponse.json(
          { success: false, error: 'Bulan dan tahun tidak valid' },
          { status: 400 }
        );
      }
    }

    conn = await mysql.createConnection(dbConfig);

    // PERBAIKAN: Get mapping daerah dari database (ikt_daerah) - ORDER BY untuk konsistensi
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
    
    // PERBAIKAN: Pastikan tabel struktur_organisasi_ikt ada dan foreign key constraint benar
    try {
      // Pastikan tabel ada
      await conn.execute(`
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
          KEY idx_nipp_ikt (nipp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      // PERBAIKAN: Drop foreign key constraint lama jika mengarah ke tabel `daerah` (bukan `ikt_daerah`)
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
            console.log(`[IKT Bulk Upload] Dropped old foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
          } catch (e: any) {
            console.log(`[IKT Bulk Upload] Error dropping constraint ${constraint.CONSTRAINT_NAME}:`, e.message);
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
            console.log(`[IKT Bulk Upload] Dropped existing foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
          } catch (e: any) {
            console.log(`[IKT Bulk Upload] Error dropping constraint ${constraint.CONSTRAINT_NAME}:`, e.message);
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
        console.log('[IKT Bulk Upload] Added correct foreign key constraint to ikt_daerah');
      } catch (e: any) {
        // Constraint mungkin sudah ada, skip
        if (!e.message.includes('Duplicate') && !e.message.includes('already exists')) {
          console.log('[IKT Bulk Upload] Error adding foreign key constraint:', e.message);
        }
      }
    } catch (err) {
      console.error('[IKT Bulk Upload] Error ensuring table structure:', err);
    }
    
    const [daerahRows]: any = await conn.execute('SELECT id, nama, kode FROM ikt_daerah ORDER BY id');
    const existingDaerahCodes = new Set(
      (daerahRows as any[])
        .map((row: any) => String(row.kode || '').trim().toUpperCase())
        .filter((kode: string) => !!kode)
    );
    const daerahMap = new Map<string, number>();
    const daerahNameMap = new Map<string, number>();
    
    // Log untuk debug
    console.log(`[DEBUG IKT] Found ${(daerahRows as any[]).length} daerah in database`);
    if ((daerahRows as any[]).length > 0) {
      console.log(`[DEBUG IKT] All daerah:`, (daerahRows as any[]).map(r => ({ id: r.id, nama: r.nama, kode: r.kode })));
    }
    
    // Build maps dengan berbagai variasi untuk fleksibilitas maksimal
    for (const row of daerahRows as any[]) {
      const kode = String(row.kode || '').trim();
      const nama = String(row.nama || '').trim();
      
      if (kode) {
        // Add kode dengan berbagai variasi
        daerahMap.set(kode.toUpperCase(), row.id);
        daerahMap.set(kode.toUpperCase().trim(), row.id);
      }
      
      if (nama) {
        // Add nama dengan berbagai variasi
        const namaUpper = nama.toUpperCase().trim();
        const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, ''); // Normalized spaces and dash
        daerahNameMap.set(namaUpper, row.id);
        daerahNameMap.set(namaUpper.replace(/\s+/g, ' '), row.id); // Normalized spaces
        daerahNameMap.set(namaNormalized, row.id); // Normalized spaces and dash
        daerahNameMap.set(namaUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), row.id); // Without prefix
        daerahNameMap.set(namaNormalized.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), row.id); // Without prefix, normalized
      }
    }
    
    console.log(`[DEBUG IKT] daerahMap size: ${daerahMap.size}, daerahNameMap size: ${daerahNameMap.size}`);

    // Group rows by daerah
    const rowsByDaerah = new Map<number, any[]>();
    const errors: any[] = [];
    let totalRows = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      totalRows++;
      
      // PERBAIKAN: Gunakan getFieldFromRow untuk fleksibilitas maksimal (case-insensitive, variasi nama)
      let daerahValue: string | null = null;
      if (usingDirektoratFallback) {
        // Untuk DIREKTORAT, gunakan getFieldFromRow dengan berbagai variasi
        daerahValue = getFieldFromRow(row, [
          daerahColumnName, // Original column name dari detectDirektoratColumn
          'DIREKTORAT', 'DIRECTORATE', 'DIVISI', 'DIVISION', 'DEPARTMENT',
          'direktorat', 'directorate', 'divisi', 'division', 'department'
        ]);
      } else {
        // Untuk DAERAH, gunakan getFieldFromRow dengan berbagai variasi
        daerahValue = getFieldFromRow(row, [
          daerahColumnName, // Original column name dari detectDaerahColumn
          'DAERAH', 'DAERAH_ID', 'KODE DAERAH', 'NAMA DAERAH', 'KODE_DAERAH', 'NAMA_DAERAH',
          'daerah', 'daerah_id', 'kode daerah', 'nama daerah', 'kode_daerah', 'nama_daerah'
        ]);
      }
      
      if (!daerahValue || !daerahValue.trim()) {
        errors.push({
          row: i + 2, // +2 karena header + 1-based index
          error: usingDirektoratFallback ? 'Kolom DIREKTORAT kosong' : 'Kolom DAERAH kosong',
          daerah: daerahValue || '(tidak ada)'
        });
        continue;
      }
      
      daerahValue = daerahValue.trim();

      // Cari daerah_id dengan mapping fleksibel
      let daerahId = findDaerahId(daerahValue, daerahMap, daerahNameMap, daerahRows as any[]);
      if (!daerahId && usingDirektoratFallback) {
        daerahId = await ensureDirektoratDaerah(
          conn!,
          daerahValue,
          daerahRows as any[],
          daerahMap,
          daerahNameMap,
          existingDaerahCodes
        );
        if (daerahId) {
          console.log(`[IKT Bulk Upload] Created new direktorat entry "${daerahValue}" with daerah_id ${daerahId}`);
        }
      }
      
      if (!daerahId) {
        // Debug: log untuk troubleshooting
        console.log(`[DEBUG] Failed to find daerah for: "${daerahValue}"`);
        console.log(`[DEBUG] Input normalized: "${daerahValue.toUpperCase().trim().replace(/\s+/g, ' ')}"`);
        console.log(`[DEBUG] Available in map: ${daerahNameMap.has(daerahValue.toUpperCase().trim())}`);
        
        // Coba debug: tampilkan daftar daerah yang ada di database untuk membantu troubleshooting
        const availableDaerah = (daerahRows as any[]).slice(0, 10).map(r => `"${r.nama}" (${r.kode})`).join(', ');
        errors.push({
          row: i + 2,
          error: `Daerah "${daerahValue}" tidak ditemukan di database`,
          daerah: daerahValue,
          suggestion: `Format yang didukung: "IKT Belawan", "Belawan", atau "BLW" (kode). Contoh daerah yang ada: ${availableDaerah}...`
        });
        continue;
      }

      // Get bulan dan tahun
      let bulan: number;
      let tahun: number;
      
      if (hasPeriodInExcel) {
        const bulanVal = row[bulanCol!];
        const tahunVal = row[tahunCol!];
        
        if (!bulanVal || !tahunVal) {
          errors.push({
            row: i + 2,
            error: 'BULAN atau TAHUN kosong di Excel',
            daerah: daerahValue
          });
          continue;
        }
        
        bulan = parseInt(String(bulanVal));
        tahun = parseInt(String(tahunVal));
        
        if (isNaN(bulan) || isNaN(tahun) || bulan < 1 || bulan > 12) {
          errors.push({
            row: i + 2,
            error: 'BULAN atau TAHUN tidak valid',
            daerah: daerahValue
          });
          continue;
        }
      } else {
        bulan = bulanDefault!;
        tahun = tahunDefault!;
      }

      // Validasi ID POSISI SAP
      const sap = String(row["ID POSISI SAP"] || '').trim();
      if (!sap) {
        errors.push({
          row: i + 2,
          error: 'ID POSISI SAP kosong',
          daerah: daerahValue
        });
        continue;
      }

      // Add to group
      if (!rowsByDaerah.has(daerahId)) {
        rowsByDaerah.set(daerahId, []);
      }
      
      // Simpan row number untuk tracking error
      const rowWithPeriod = { ...row, _bulan: bulan, _tahun: tahun, _daerah_id: daerahId, _row_number: i + 2 };
      rowsByDaerah.get(daerahId)!.push(rowWithPeriod);
    }

    // Process each daerah
    const daerahDetails: any[] = [];
    let totalPosisiBerhasil = 0;
    let totalPosisiGagal = errors.length;

    for (const [daerahId, rows] of rowsByDaerah.entries()) {
      try {
        await conn.beginTransaction();

        // Get daerah name
        const [daerahInfo]: any = await conn.execute('SELECT nama FROM ikt_daerah WHERE id = ?', [daerahId]);
        const daerahNama = (daerahInfo as any[])[0]?.nama || `Daerah ID ${daerahId}`;

        // Group by periode
        const rowsByPeriode = new Map<string, any[]>();
        for (const row of rows) {
          const key = `${row._bulan}-${row._tahun}`;
          if (!rowsByPeriode.has(key)) {
            rowsByPeriode.set(key, []);
          }
          rowsByPeriode.get(key)!.push(row);
        }

        let daerahPosisiBerhasil = 0;
        let daerahFotoDariPeriodeSebelumnya = 0;

        for (const [periodeKey, periodeRows] of rowsByPeriode.entries()) {
          const [bulanPeriode, tahunPeriode] = periodeKey.split('-').map(Number);

          // Build set of valid SAP IDs untuk validasi per row
          const validSapSet = new Set<string>();
          
          for (const row of periodeRows) {
            const sap = String(row["ID POSISI SAP"] || row["id posisi sap"] || '').trim();
            if (sap) {
              validSapSet.add(sap);
            }
          }

          // Collect semua SAP IDs yang akan di-insert untuk tracking
          const sapIdsToInsert = new Set<string>();
          for (const row of periodeRows) {
            const sap = String(row["ID POSISI SAP"] || row["id posisi sap"] || '').trim();
            if (sap) {
              sapIdsToInsert.add(sap);
            }
          }

          // PERBAIKAN: Sebelum DELETE, ambil dulu photo_url yang sudah ada untuk periode tersebut
          // Ini mencegah foto yang sudah di-upload manual hilang saat menyimpan ulang Excel
          const existingPhotos = new Map<string, string>();
          if (sapIdsToInsert.size > 0) {
            const sapIdsArray = Array.from(sapIdsToInsert);
            const placeholders = sapIdsArray.map(() => '?').join(',');
            
            // Ambil photo_url yang sudah ada sebelum DELETE
            try {
              const [existingRows]: any = await conn.execute(
                `SELECT id_posisi_sap, photo_url 
                 FROM struktur_organisasi_ikt 
                 WHERE daerah_id = ? AND bulan = ? AND tahun = ? 
                 AND id_posisi_sap IN (${placeholders})
                 AND photo_url IS NOT NULL 
                 AND TRIM(photo_url) != ''`,
                [daerahId, bulanPeriode, tahunPeriode, ...sapIdsArray]
              );
              
              // Simpan ke map untuk digunakan kembali setelah INSERT
              for (const row of existingRows as any[]) {
                if (row.photo_url && row.photo_url.trim() !== '') {
                  existingPhotos.set(row.id_posisi_sap, row.photo_url.trim());
                  console.log(`[ikt-bulk-upload] Preserving photo for ${row.id_posisi_sap}: ${row.photo_url}`);
                }
              }
              
              if (existingPhotos.size > 0) {
                console.log(`[ikt-bulk-upload] Found ${existingPhotos.size} existing photos to preserve for periode ${bulanPeriode}/${tahunPeriode}`);
              }
            } catch (err) {
              console.error(`[ikt-bulk-upload] Error fetching existing photos:`, err);
              // Continue dengan DELETE meskipun error
            }
            
            // Baru hapus data lama yang akan di-replace
            await conn.execute(
              'DELETE FROM struktur_organisasi_ikt WHERE daerah_id = ? AND bulan = ? AND tahun = ? AND id_posisi_sap IN (' + placeholders + ')',
              [daerahId, bulanPeriode, tahunPeriode, ...sapIdsArray]
            );
          }

          // Insert data - skip hanya row yang bermasalah
          for (const row of periodeRows) {
            try {
              const sap = String(row["ID POSISI SAP"] || row["id posisi sap"] || '').trim();
              const rowNumber = row._row_number || data.indexOf(row) + 2;
              
              if (!sap) {
                errors.push({
                  daerah: daerahNama,
                  row: rowNumber,
                  error: 'ID POSISI SAP kosong'
                });
                totalPosisiGagal++;
                continue;
              }

              let atasan = row["ID POSISI ATASAN"] || row["id posisi atasan"] ? String(row["ID POSISI ATASAN"] || row["id posisi atasan"]).trim() : null;
              
              // Validasi: jika ada ID POSISI ATASAN, pastikan ada di data yang sama
              if (atasan) {
                if (!validSapSet.has(atasan)) {
                  const sapNama = row["NAMA"] || row["nama"] || sap;
                  // Hanya tambahkan error jika belum ada (hindari duplikasi)
                  const errorExists = errors.some(e => 
                    e.daerah === daerahNama && 
                    e.id_posisi_sap === sap && 
                    e.error?.includes(atasan || '')
                  );
                  
                  if (!errorExists) {
                    errors.push({
                      daerah: daerahNama,
                      row: rowNumber,
                      id_posisi_sap: sap,
                      error: `ID POSISI ATASAN "${atasan}" tidak ditemukan di data Excel. Posisi "${sap}" (${sapNama}) akan disimpan tanpa atasan.`
                    });
                  }
                  // Set atasan = null agar data tetap tersimpan (tanpa hierarki)
                  atasan = null;
                }
              }
              
              const nama = row["NAMA"] || row["nama"] || row["Nama"] || null;
              const jabatan = row["JABATAN"] || row["jabatan"] || row["Jabatan"] || null;
              const unitKerja = row["UNIT KERJA"] || row["unit kerja"] || row["Unit Kerja"] || null;
              // Handle NIPP: jika format "10001 BOD-1", ambil hanya bagian angka (opsional, bisa juga simpan lengkap)
              const nippRaw = row["NIPP"] || row["nipp"] || null;
              let nipp = null;
              if (nippRaw) {
                const nippStr = String(nippRaw).trim();
                // Extract hanya angka dari NIPP (jika format "10001 BOD-1" -> "10001")
                // Tapi bisa juga simpan lengkap jika user mau
                const nippMatch = nippStr.match(/^(\d+)/);
                nipp = nippMatch ? nippMatch[1] : nippStr; // Ambil angka saja, atau seluruh string jika tidak ada angka
              }
              
              // PERBAIKAN: Ambil direktorat dengan berbagai variasi nama kolom (case-insensitive)
              // Prioritas 1: Kolom DIREKTORAT
              let direktorat = normalizeValue(getFieldFromRow(row, ["DIREKTORAT", "DIRECTORATE", "DIVISI", "DIVISION", "direktorat", "directorate"]));
              
              // Prioritas 2: Jika direktorat kosong, coba ambil dari unit_kerja
              if (!direktorat) {
                const unitKerjaStr = unitKerja ? String(unitKerja).trim() : '';
                if (unitKerjaStr && unitKerjaStr !== '') {
                  direktorat = normalizeValue(unitKerjaStr);
                  console.log(`[ikt-bulk-upload] Row ${row._row_number}: direktorat kosong, menggunakan unit_kerja: ${direktorat}`);
                }
              }
              
              // Prioritas 3: Jika masih kosong dan menggunakan direktorat untuk mapping, gunakan nilai dari mapping column
              if (!direktorat && usingDirektoratFallback && daerahColumnName) {
                const mappingValue = String(row[daerahColumnName] || '').trim();
                if (mappingValue) {
                  direktorat = normalizeValue(mappingValue);
                  console.log(`[ikt-bulk-upload] Row ${row._row_number}: direktorat kosong, menggunakan mapping column (${daerahColumnName}): ${direktorat}`);
                }
              }
              
              // Log jika direktorat masih kosong untuk debugging (hanya beberapa row pertama)
              if (!direktorat && row._row_number <= 3) {
                console.log(`[ikt-bulk-upload] Row ${row._row_number}: direktorat is still null/empty after all attempts.`);
                console.log(`[ikt-bulk-upload] Row ${row._row_number}: unit_kerja:`, unitKerja);
                console.log(`[ikt-bulk-upload] Row ${row._row_number}: mappingColumn:`, daerahColumnName);
              }
              // PERBAIKAN: Ambil semua field dengan berbagai variasi nama kolom (case-insensitive)
              const photoUrl = normalizeValue(getFieldFromRow(row, ["PHOTO_URL", "photo_url", "PHOTO URL", "photo url", "Photo URL"]));
              const noHp = normalizeValue(getFieldFromRow(row, ["NO HP", "NO. HP", "NO_HP", "no_hp", "No. HP", "no hp", "No HP", "HANDHPONE", "handphone", "HP", "hp"]));
              const tmtJabatan = formatDateForMySQL(normalizeValue(getFieldFromRow(row, ["TMT JABATAN", "TMT_JABATAN", "tmt_jabatan", "Tmt Jabatan", "tmt jabatan", "TMT"])));
              const periodeJabatan = normalizeValue(getFieldFromRow(row, ["PERIODE JABATAN", "PERIODE_JABATAN", "periode_jabatan", "Periode Jabatan", "periode jabatan", "PERIODE"]));
              const kjIndividu = normalizeValue(getFieldFromRow(row, ["KJ INDIVIDU", "KJ_INDIVIDU", "kj_individu", "Kj Individu", "kj individu", "KJINDIVIDU"]));
              const kjPosisi = normalizeValue(getFieldFromRow(row, ["KJ POSISI", "KJ_POSISI", "kj_posisi", "Kj Posisi", "kj posisi", "KJPOSISI"]));

              // PERBAIKAN: Logika prioritas untuk photo_url
              // PRIORITAS 1: Gunakan photo_url dari Excel jika ada
              // PRIORITAS 2: Gunakan photo_url yang sudah ada sebelumnya untuk periode yang sama (yang baru dihapus)
              // PRIORITAS 3: Fallback ke foto dari periode sebelumnya
              let finalPhotoUrl = photoUrl;
              if (!finalPhotoUrl) {
                // Cek dulu apakah ada foto untuk periode yang sama (sebelum DELETE)
                const existingPhoto = existingPhotos.get(sap);
                if (existingPhoto) {
                  finalPhotoUrl = existingPhoto;
                  daerahFotoDariPeriodeSebelumnya++;
                  console.log(`[ikt-bulk-upload] Using preserved photo for ${sap}: ${existingPhoto}`);
                } else {
                  // Fallback: ambil foto dari periode sebelumnya
                  const prevPhoto = await getPhotoFromPreviousPeriod(
                    conn,
                    nipp,
                    sap,
                    daerahId,
                    bulanPeriode,
                    tahunPeriode
                  );
                  if (prevPhoto) {
                    finalPhotoUrl = prevPhoto;
                    daerahFotoDariPeriodeSebelumnya++;
                    console.log(`[ikt-bulk-upload] Using photo from previous period for ${sap}: ${prevPhoto}`);
                  }
                }
              }

              await conn.execute(
                `INSERT INTO struktur_organisasi_ikt
                  (id_posisi_sap, id_posisi_atasan, daerah_id, nama, jabatan, unit_kerja, nipp, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                  kj_posisi = VALUES(kj_posisi)`,
                [
                  sap,
                  atasan,
                  daerahId,
                  nama,
                  jabatan,
                  unitKerja,
                  nipp,
                  direktorat,
                  finalPhotoUrl,
                  noHp,
                  tmtJabatan,
                  periodeJabatan,
                  kjIndividu,
                  kjPosisi,
                  bulanPeriode,
                  tahunPeriode
                ]
              );

              daerahPosisiBerhasil++;
            } catch (rowError: any) {
              errors.push({
                daerah: daerahNama,
                row: data.indexOf(row) + 2,
                id_posisi_sap: row["ID POSISI SAP"],
                error: rowError.message || 'Gagal insert row'
              });
              totalPosisiGagal++;
            }
          }
        }

        await conn.commit();

        daerahDetails.push({
          daerah_id: daerahId,
          daerah_nama: daerahNama,
          total_posisi: daerahPosisiBerhasil,
          status: 'success',
          foto_diambil_dari_periode_sebelumnya: daerahFotoDariPeriodeSebelumnya
        });

        totalPosisiBerhasil += daerahPosisiBerhasil;
      } catch (daerahError: any) {
        await conn.rollback();
        errors.push({
          daerah: `Daerah ID ${daerahId}`,
          error: daerahError.message || 'Gagal memproses daerah'
        });
        totalPosisiGagal += rows.length;
      }
    }

    await conn.end();

    return NextResponse.json({
      success: true,
      summary: {
        total_daerah: daerahDetails.length,
        total_posisi: totalRows,
        total_posisi_berhasil: totalPosisiBerhasil,
        total_posisi_gagal: totalPosisiGagal,
        grouping_mode: usingDirektoratFallback ? 'direktorat' : 'daerah',
        periode_digunakan: {
          bulan: hasPeriodInExcel ? '(berbeda per row)' : bulanDefault,
          tahun: hasPeriodInExcel ? '(berbeda per row)' : tahunDefault,
          sumber: hasPeriodInExcel ? 'excel_column' : 'form_input'
        },
        daerah_details: daerahDetails,
        errors: errors
      }
    });
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    if (conn) {
      try {
        await conn.rollback();
        await conn.end();
      } catch {}
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses bulk upload' },
      { status: 500 }
    );
  }
}
