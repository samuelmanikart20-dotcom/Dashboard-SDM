import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { read, utils } from 'xlsx';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
};

// Helper function untuk mengkonversi format tanggal ke MySQL DATE format (YYYY-MM-DD)
// Handle berbagai format: Excel serial number, string date, Date object
function formatDateForMySQL(dateValue: any): string | null {
  if (!dateValue && dateValue !== 0) return null;
  
  // Jika sudah dalam format YYYY-MM-DD
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  // Handle Excel date serial number (misalnya 45292, 45083, dll)
  // Excel date serial number dimulai dari 1 Januari 1900
  // Nilai bisa berupa number atau string yang hanya berisi angka
  const strValue = String(dateValue).trim();
  const isNumericString = /^\d+(\.\d+)?$/.test(strValue);
  const isNumber = typeof dateValue === 'number';
  
  if (isNumber || isNumericString) {
    const serialNumber = isNumber ? dateValue : parseFloat(strValue);
    
    // Excel date serial number biasanya antara 1 (1 Jan 1900) sampai ~100000 (sekitar tahun 2174)
    // Tapi bisa juga lebih besar jika ada error parsing
    // Nilai yang sangat besar (seperti 45292-01-01) kemungkinan adalah error parsing, skip
    if (serialNumber > 0 && serialNumber < 1000000 && !isNaN(serialNumber)) {
      try {
        // Excel epoch: 1 Januari 1900 (tapi Excel menghitung 1900 sebagai tahun kabisat, jadi perlu adjustment)
        // JavaScript Date epoch: 1 Januari 1970
        // Excel menghitung dari 1 Jan 1900 sebagai hari 1, tapi JavaScript Date menghitung dari 1 Jan 1970
        // Perbedaan: 70 tahun * 365.25 hari = ~25569 hari
        // Tapi Excel menghitung 1900 sebagai kabisat (padahal tidak), jadi perlu adjustment -1
        const excelEpoch = new Date(1899, 11, 30); // 30 Des 1899 (karena Excel menghitung dari 1 Jan 1900 sebagai hari 1)
        const jsDate = new Date(excelEpoch.getTime() + (serialNumber - 1) * 24 * 60 * 60 * 1000);
        
        if (!isNaN(jsDate.getTime())) {
          const year = jsDate.getFullYear();
          const month = String(jsDate.getMonth() + 1).padStart(2, '0');
          const day = String(jsDate.getDate()).padStart(2, '0');
          
          // Validasi: tahun harus masuk akal (1900-2100)
          if (year >= 1900 && year <= 2100) {
            return `${year}-${month}-${day}`;
          }
        }
      } catch (e) {
        // Fallback ke parsing normal
        console.warn(`[formatDateForMySQL] Failed to convert Excel serial number ${serialNumber}:`, e);
      }
    }
  }
  
  // Handle format string date (DD-MM-YYYY, MM/DD/YYYY, dll)
  if (typeof dateValue === 'string') {
    const str = strValue;
    
    // PERBAIKAN: Deteksi format yang salah seperti "45231-01-01" (Excel serial number yang ter-format salah)
    // Coba konversi dari serial number yang ter-format salah
    const wrongFormatMatch = str.match(/^(\d{5,})-\d{2}-\d{2}$/);
    if (wrongFormatMatch) {
      const serialNumber = parseInt(wrongFormatMatch[1]);
      if (serialNumber >= 1 && serialNumber < 1000000) {
        try {
          // Konversi dari Excel serial number
          const excelEpoch = new Date(1899, 11, 30); // 30 Des 1899
          const jsDate = new Date(excelEpoch.getTime() + (serialNumber - 1) * 24 * 60 * 60 * 1000);
          
          if (!isNaN(jsDate.getTime())) {
            const year = jsDate.getFullYear();
            if (year >= 1900 && year <= 2100) {
              const month = String(jsDate.getMonth() + 1).padStart(2, '0');
              const day = String(jsDate.getDate()).padStart(2, '0');
              const formatted = `${year}-${month}-${day}`;
              console.log(`[formatDateForMySQL] Converted wrong format "${str}" (serial ${serialNumber}) to ${formatted}`);
              return formatted;
            }
          }
        } catch (e) {
          console.warn(`[formatDateForMySQL] Failed to convert wrong format "${str}":`, e);
        }
      }
      // Jika gagal konversi, return null (jangan skip, tapi coba konversi dulu)
    }
    
    // Coba parse format DD-MM-YYYY atau DD/MM/YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1]);
      const month = parseInt(ddmmyyyy[2]);
      const year = parseInt(ddmmyyyy[3]);
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Coba parse dengan Date constructor
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year >= 1900 && year <= 2100) {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Fallback: coba parse sebagai Date object
  try {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  } catch (error) {
    console.error('Error formatting date:', dateValue, error);
  }
  
  return null;
}

// Helper function untuk normalize nilai
function normalizeValue(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  return str && str !== '-' ? str : null;
}

// Deteksi kolom DAERAH dengan variasi nama (case-insensitive, trim whitespace)
function detectDaerahColumn(headers: string[]): string | null {
  // Normalize headers: trim dan uppercase untuk matching
  const normalizedHeaders = new Map<string, string>();
  headers.forEach(h => {
    const normalized = h.trim().toUpperCase();
    normalizedHeaders.set(normalized, h); // Simpan original untuk return
  });
  
  const daerahVariants = [
    'DAERAH', 
    'DAERAH_ID', 
    'KODE DAERAH', 
    'NAMA DAERAH', 
    'KODE_DAERAH', 
    'NAMA_DAERAH',
    'DAERAH ID',
    'KODE_DAERAH',
    'NAMA_DAERAH',
    'REGION',
    'REGION_ID',
    'KODE_REGION',
    'NAMA_REGION',
    'CABANG',
    'CABANG_ID',
    'KODE_CABANG',
    'NAMA_CABANG'
  ];
  
  // Cari exact match dulu
  for (const variant of daerahVariants) {
    const normalized = variant.trim().toUpperCase();
    if (normalizedHeaders.has(normalized)) {
      return normalizedHeaders.get(normalized)!; // Return original header name
    }
  }
  
  // Jika tidak ditemukan exact match, cari partial match (contains)
  for (const [normalized, original] of normalizedHeaders.entries()) {
    if (normalized.includes('DAERAH') || 
        normalized.includes('REGION') || 
        normalized.includes('CABANG') ||
        normalized.includes('KODE') && (normalized.includes('DAERAH') || normalized.includes('REGION') || normalized.includes('CABANG'))) {
      console.log(`[detectDaerahColumn] Found partial match: "${original}" (normalized: "${normalized}")`);
      return original;
    }
  }
  
  console.log(`[detectDaerahColumn] No match found. Available headers:`, headers);
  return null;
}

// Deteksi kolom DIREKTORAT
function detectDirektoratColumn(headers: string[]): string | null {
  const variants = ['DIREKTORAT', 'DIRECTORATE', 'DIVISI', 'DIVISION', 'DEPARTMENT'];
  for (const variant of variants) {
    if (headers.includes(variant)) {
      return variant;
    }
  }
  return null;
}

// Generate kode untuk direktorat baru
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

// Ensure direktorat exists in daerah table (untuk SPMT)
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
  const [existing]: any = await conn.execute(
    'SELECT id, kode FROM daerah WHERE UPPER(nama) = ? LIMIT 1',
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
    return id;
  }

  // Create new entry
  const kode = generateDirektoratKode(cleanName, existingCodes);
  const [result]: any = await conn.execute(
    'INSERT INTO daerah (nama, kode) VALUES (?, ?)',
    [cleanName, kode]
  );
  const newId = (result as any).insertId;
  daerahRows.push({ id: newId, nama: cleanName, kode });
  daerahMap.set(kode.toUpperCase(), newId);
  const namaUpper = cleanName.toUpperCase().trim();
  const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, '');
  daerahNameMap.set(namaUpper, newId);
  daerahNameMap.set(namaUpper.replace(/\s+/g, ' '), newId);
  daerahNameMap.set(namaNormalized, newId);
  return newId;
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
      FROM org_position_nodes
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
  
  // 2. Direct match dengan nama lengkap (dengan prefix SPMT)
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
  
  // 4. Match nama tanpa prefix "SPMT" (contoh: "Belawan" -> "SPMT Belawan")
  const namaWithoutPrefix = daerahUpper.replace(/^SPMT\s+/i, '').trim();
  if (namaWithoutPrefix.length > 0) {
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^SPMT\s+/i, '').trim();
      
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
      const dbNamaWithoutPrefix = dbNama.replace(/^SPMT\s+/i, '').trim();
      
      if (normalize(dbNamaWithoutPrefix) === namaDaerah || dbNama.includes(namaDaerah)) {
        return row.id;
      }
    }
  }
  
  // 6. Fuzzy match - cari nama yang mengandung kata kunci utama (lebih toleran)
  const keywords = daerahUpper.split(/\s+/).filter(k => k.length > 2 && k !== 'SPMT' && k !== 'PTP');
  if (keywords.length > 0) {
    // Ambil keyword terpanjang sebagai primary keyword
    const primaryKeyword = keywords.sort((a, b) => b.length - a.length)[0];
    
    // Score-based matching: cari yang paling cocok
    let bestMatch: { id: number; score: number } | null = null;
    
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbKode = normalize(String(row.kode || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^SPMT\s+/i, '').trim();
      
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
      const dbNamaWithoutPrefix = dbNama.replace(/^SPMT\s+/i, '').trim();
      
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

// Helper function untuk menghitung similarity percentage
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toUpperCase().trim();
  const s2 = str2.toUpperCase().trim();
  if (s1 === s2) return 100;
  
  const chars1 = new Set(s1.split(''));
  const chars2 = new Set(s2.split(''));
  const intersection = Array.from(chars1).filter(c => chars2.has(c)).length;
  const union = new Set([...chars1, ...chars2]).size;
  
  return Math.round((intersection / union) * 100);
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
    const workbook = read(buffer, { type: 'buffer', raw: true }); // raw: true to get raw numbers for dates
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<any>(sheet, { defval: null, raw: true }); // raw: true here too

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File Excel kosong atau tidak valid' },
        { status: 400 }
      );
    }

    // Get headers
    const headers = Object.keys(data[0] || {});
    console.log(`[bulk-upload] Excel headers found:`, headers);
    
    // PERBAIKAN: Prioritas kolom DIREKTORAT untuk SPMT (bukan DAERAH)
    // Untuk SPMT, kolom DIREKTORAT digunakan untuk mapping ke daerah
    const direktoratColumn = detectDirektoratColumn(headers);
    const daerahColumn = detectDaerahColumn(headers);
    let usingDirektoratFallback = false;
    let daerahColumnName: string;
    
    // Prioritas 1: Gunakan DIREKTORAT jika ada (untuk SPMT)
    if (direktoratColumn) {
      daerahColumnName = direktoratColumn;
      usingDirektoratFallback = true;
      console.log('[SPMT Bulk Upload] Using DIREKTORAT column for mapping to daerah.');
    } else if (daerahColumn) {
      // Prioritas 2: Gunakan DAERAH jika DIREKTORAT tidak ada
      daerahColumnName = daerahColumn;
      usingDirektoratFallback = false;
      console.log('[SPMT Bulk Upload] DIREKTORAT column not found. Using DAERAH column.');
    } else {
      // Error jika kedua kolom tidak ditemukan
      return NextResponse.json(
        { success: false, error: 'Kolom DIREKTORAT atau DAERAH tidak ditemukan. Untuk SPMT, pastikan file Excel memiliki kolom "DIREKTORAT" untuk mapping ke daerah.' },
        { status: 400 }
      );
    }
    
    console.log(`[Bulk Upload] Detected column: "${daerahColumnName}" (usingDirektoratFallback: ${usingDirektoratFallback})`);
    
    // Log sample values dari kolom untuk debugging
    const sampleValues = data.slice(0, Math.min(10, data.length)).map((row, idx) => {
      const value = String(row[daerahColumnName] || '').trim();
      return { row: idx + 2, value };
    });
    console.log(`[Bulk Upload] Sample values from first 10 rows:`, sampleValues);

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

    // Get mapping daerah dari database - ORDER BY untuk konsistensi
    const [daerahRows]: any = await conn.execute('SELECT id, nama, kode FROM daerah ORDER BY id');
    const existingDaerahCodes = new Set(
      (daerahRows as any[])
        .map((row: any) => String(row.kode || '').trim().toUpperCase())
        .filter((kode: string) => !!kode)
    );
    const daerahMap = new Map<string, number>();
    const daerahNameMap = new Map<string, number>();
    
    // Log untuk debug
    console.log(`[DEBUG] Found ${(daerahRows as any[]).length} daerah in database`);
    if ((daerahRows as any[]).length > 0) {
      console.log(`[DEBUG] All daerah:`, (daerahRows as any[]).map(r => ({ id: r.id, nama: r.nama, kode: r.kode })));
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
        daerahNameMap.set(namaUpper.replace(/^SPMT\s+/i, '').trim(), row.id); // Without prefix
        daerahNameMap.set(namaNormalized.replace(/^SPMT\s+/i, '').trim(), row.id); // Without prefix, normalized
      }
    }
    
    console.log(`[DEBUG] daerahMap size: ${daerahMap.size}, daerahNameMap size: ${daerahNameMap.size}`);

    // Group rows by daerah
    const rowsByDaerah = new Map<number, any[]>();
    const errors: any[] = [];
    let totalRows = 0;
    
    // Track unique daerah values untuk debugging
    const daerahValuesSeen = new Set<string>();
    const daerahValueCounts = new Map<string, number>();

    console.log(`[Bulk Upload] Starting to process ${data.length} rows with column: "${daerahColumnName}"`);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      totalRows++;
      
      const daerahValue = String(row[daerahColumnName] || '').trim();
      
      // Track unique values
      if (daerahValue) {
        daerahValuesSeen.add(daerahValue);
        daerahValueCounts.set(daerahValue, (daerahValueCounts.get(daerahValue) || 0) + 1);
      }
      
      if (!daerahValue) {
        errors.push({
          row: i + 2, // +2 karena header + 1-based index
          error: usingDirektoratFallback ? 'Kolom DIREKTORAT kosong' : 'Kolom DAERAH kosong',
          daerah: daerahValue || '(tidak ada)'
        });
        continue;
      }

      // Debug: log input sebelum mapping
      const daerahValueDebug = daerahValue;
      const daerahValueBytes = Array.from(new TextEncoder().encode(daerahValue)).join(',');
      console.log(`[DEBUG] Row ${i + 2}: Input daerah="${daerahValue}" (bytes: ${daerahValueBytes})`);
      
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
          console.log(`[SPMT Bulk Upload] Created new direktorat entry "${daerahValue}" with daerah_id ${daerahId}`);
        }
      }
      
      // Fallback: Query langsung ke database jika tidak ditemukan di map
      if (!daerahId) {
        try {
          // Normalize untuk query: remove dash dan spaces
          const searchValue = daerahValue.toUpperCase().trim().replace(/-/g, '').replace(/\s+/g, '%');
          const searchPattern = `%${searchValue}%`;
          
          // Query dengan berbagai variasi
          const [directQuery]: any = await conn.execute(
            `SELECT id, nama, kode FROM daerah 
             WHERE REPLACE(REPLACE(UPPER(TRIM(nama)), '-', ''), ' ', '') LIKE ? 
                OR REPLACE(UPPER(TRIM(nama)), '-', '') LIKE ?
                OR UPPER(TRIM(nama)) LIKE ?
                OR UPPER(TRIM(kode)) = ?
             LIMIT 1`,
            [
              searchPattern, // Full normalized match
              `%${daerahValue.toUpperCase().trim().replace(/-/g, '')}%`, // Without dash
              `%${daerahValue.toUpperCase().trim()}%`, // Original
              daerahValue.toUpperCase().trim() // Kode exact match
            ]
          );
          
          if (Array.isArray(directQuery) && directQuery.length > 0) {
            daerahId = directQuery[0].id;
            console.log(`[DEBUG] Row ${i + 2}: Found via direct query: "${daerahValue}" -> daerah_id ${daerahId} (${directQuery[0].nama})`);
          }
        } catch (queryError) {
          console.error(`[DEBUG] Direct query error:`, queryError);
        }
      }
      
      if (!daerahId) {
        // Debug: log untuk troubleshooting
        console.log(`[DEBUG] Failed to find daerah for: "${daerahValue}"`);
        console.log(`[DEBUG] Input length: ${daerahValue.length}, char codes: ${Array.from(daerahValue).map(c => c.charCodeAt(0)).join(',')}`);
        console.log(`[DEBUG] Input normalized: "${daerahValue.toUpperCase().trim().replace(/\s+/g, ' ')}"`);
        
        // Cek apakah ada di map dengan berbagai variasi
        const testVariations = [
          daerahValue.toUpperCase().trim(),
          daerahValue.toUpperCase().trim().replace(/\s+/g, ' '),
          daerahValue.toUpperCase().trim().replace(/^SPMT\s+/i, ''),
        ];
        console.log(`[DEBUG] Testing variations:`, testVariations.map(v => ({ v, inMap: daerahNameMap.has(v) })));
        
        // Cek semua daerah di database untuk similarity
        console.log(`[DEBUG] Comparing with database:`);
        for (const row of (daerahRows as any[])) {
          const dbNama = String(row.nama || '').toUpperCase().trim();
          const similarity = calculateSimilarity(daerahValue.toUpperCase().trim(), dbNama);
          if (similarity > 50) {
            console.log(`[DEBUG]   "${dbNama}" vs "${daerahValue.toUpperCase().trim()}" = ${similarity}%`);
          }
        }
        
        // Coba debug: tampilkan daftar daerah yang ada di database untuk membantu troubleshooting
        const availableDaerah = (daerahRows as any[]).map(r => `"${r.nama}" (${r.kode})`).join(', ');
        errors.push({
          row: i + 2,
          error: `Daerah "${daerahValue}" tidak ditemukan di database`,
          daerah: daerahValue,
          suggestion: `Format yang didukung: "SPMT Belawan", "Belawan", atau "BLW" (kode). Daerah yang ada di database: ${availableDaerah}`
        });
        continue;
      }
      
      console.log(`[DEBUG] Row ${i + 2}: Successfully mapped "${daerahValue}" -> daerah_id ${daerahId}`);

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

    // Log summary daerah values yang ditemukan di Excel
    console.log(`[Bulk Upload] Found ${daerahValuesSeen.size} unique DAERAH values in Excel:`);
    for (const [value, count] of Array.from(daerahValueCounts.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`[Bulk Upload]   - "${value}": ${count} rows`);
    }

    // Log summary per daerah sebelum processing
    console.log(`[Bulk Upload] Summary: Found ${rowsByDaerah.size} unique daerah IDs after mapping:`);
    for (const [daerahId, rows] of rowsByDaerah.entries()) {
      const [daerahInfo]: any = await conn.execute('SELECT nama FROM daerah WHERE id = ?', [daerahId]);
      const daerahNama = (daerahInfo as any[])[0]?.nama || `Daerah ID ${daerahId}`;
      console.log(`[Bulk Upload]   - Daerah ${daerahId} (${daerahNama}): ${rows.length} rows`);
    }

    // Process each daerah
    const daerahDetails: any[] = [];
    let totalPosisiBerhasil = 0;
    let totalPosisiGagal = errors.length;

    for (const [daerahId, rows] of rowsByDaerah.entries()) {
      try {
        await conn.beginTransaction();

        // Get daerah name
        const [daerahInfo]: any = await conn.execute('SELECT nama FROM daerah WHERE id = ?', [daerahId]);
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
            // PERBAIKAN: HANYA cari foto dari periode yang SAMA, JANGAN ambil dari periode lain
            // Ini memastikan foto yang di-edit di "Lihat Struktur Organisasi" tetap muncul di "Upload Struktur Organisasi"
            // dan foto dari periode lain tidak ikut ter-copy
            try {
              // Hanya cari foto dari periode yang sama
              const [existingRows]: any = await conn.execute(
                `SELECT id_posisi_sap, photo_url 
                 FROM org_position_nodes 
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
                  console.log(`[bulk-upload] Preserving photo for ${row.id_posisi_sap} from same period (${bulanPeriode}/${tahunPeriode}): ${row.photo_url}`);
                }
              }
              
              // PERBAIKAN: JANGAN ambil foto dari periode lain
              // Jika tidak ada foto di periode yang sama, biarkan NULL (tidak copy dari periode lain)
              // Ini mencegah foto dari periode lain ikut ter-copy ke periode yang berbeda
              
              if (existingPhotos.size > 0) {
                console.log(`[bulk-upload] Found ${existingPhotos.size} existing photos to preserve for periode ${bulanPeriode}/${tahunPeriode} (from same period only)`);
              } else {
                console.log(`[bulk-upload] No existing photos found to preserve for periode ${bulanPeriode}/${tahunPeriode} (will not copy from other periods)`);
              }
            } catch (err) {
              console.error(`[bulk-upload] Error fetching existing photos:`, err);
              // Continue dengan DELETE meskipun error
            }
            
            // Baru hapus data lama yang akan di-replace
            await conn.execute(
              `DELETE FROM org_position_nodes 
               WHERE daerah_id = ? AND bulan = ? AND tahun = ? 
               AND id_posisi_sap IN (${placeholders})`,
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
              if (atasan && !validSapSet.has(atasan)) {
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
              
              // Helper function untuk mencari kolom dengan berbagai variasi (case-insensitive)
              const findColumn = (row: any, variants: string[]): any => {
                for (const variant of variants) {
                  // Exact match (case-sensitive)
                  if (row[variant] !== undefined && row[variant] !== null) {
                    return row[variant];
                  }
                  // Case-insensitive match
                  const rowKeys = Object.keys(row);
                  const foundKey = rowKeys.find(key => key.toLowerCase() === variant.toLowerCase());
                  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
                    return row[foundKey];
                  }
                }
                return null;
              };

              const direktoratRaw = findColumn(row, ["DIREKTORAT", "direktorat", "Direktorat"]);
              const direktorat = direktoratRaw ? normalizeValue(direktoratRaw) : null;
              
              // Tingkatan: cari "Tingkatan di Bawah Direksi" atau "TINGKATAN"
              const tingkatanRaw = findColumn(row, [
                "Tingkatan di Bawah Direksi",
                "TINGKATAN DI BAWAH DIREKSI",
                "TINGKATAN",
                "tingkatan",
                "Tingkatan"
              ]);
              const tingkatan = normalizeValue(tingkatanRaw);
              
              // Photo URL: cari berbagai variasi
              const photoUrlRaw = findColumn(row, [
                "PHOTO_URL",
                "photo_url",
                "PHOTO URL",
                "Photo URL",
                "Photo_Url"
              ]);
              const photoUrl = normalizeValue(photoUrlRaw);
              
              // No HP: cari berbagai variasi
              const noHpRaw = findColumn(row, [
                "NO HP",
                "No HP",
                "NO. HP",
                "No. HP",
                "NO_HP",
                "no_hp",
                "No HP"
              ]);
              const noHp = normalizeValue(noHpRaw);
              
              // Get TMT JABATAN dengan berbagai variasi nama kolom, tanpa normalizeValue untuk mempertahankan raw Excel value
              const tmtJabatanRaw = row["TMT JABATAN"] || row["TMT_JABATAN"] || row["tmt_jabatan"] || row["Tmt Jabatan"] || row["TANGGAL EFEKTIF"] || row["TANGGAL EFEKTIF/PERIODE JABATAN"];
              const tmtJabatan = formatDateForMySQL(tmtJabatanRaw);
              
              // Periode Jabatan: cari berbagai variasi
              const periodeJabatanRaw = findColumn(row, [
                "PERIODE JABATAN",
                "Periode Jabatan",
                "PERIODE_JABATAN",
                "periode_jabatan"
              ]);
              const periodeJabatan = normalizeValue(periodeJabatanRaw);
              
              // KJ Individu: cari berbagai variasi
              const kjIndividuRaw = findColumn(row, [
                "KJ INDIVIDU",
                "KJ Individu",
                "KJ_INDIVIDU",
                "kj_individu",
                "Kj Individu"
              ]);
              const kjIndividu = normalizeValue(kjIndividuRaw);
              
              // KJ Posisi: cari berbagai variasi
              const kjPosisiRaw = findColumn(row, [
                "KJ POSISI",
                "KJ Posisi",
                "KJ_POSISI",
                "kj_posisi",
                "Kj Posisi"
              ]);
              const kjPosisi = normalizeValue(kjPosisiRaw);

              // Logging untuk debugging - hanya untuk row pertama dari setiap daerah
              if (daerahPosisiBerhasil === 0) {
                console.log(`[bulk-upload] Sample row data for daerah ${daerahId} (${daerahNama}):`, {
                  sap,
                  nama,
                  'TINGKATAN (raw)': tingkatanRaw,
                  'TINGKATAN (normalized)': tingkatan,
                  'DIREKTORAT (raw)': direktoratRaw,
                  'DIREKTORAT (normalized)': direktorat,
                  'NO HP (raw)': noHpRaw,
                  'NO HP (normalized)': noHp,
                  'KJ INDIVIDU (raw)': kjIndividuRaw,
                  'KJ INDIVIDU (normalized)': kjIndividu,
                  'KJ POSISI (raw)': kjPosisiRaw,
                  'KJ POSISI (normalized)': kjPosisi,
                  'PERIODE JABATAN (raw)': periodeJabatanRaw,
                  'PERIODE JABATAN (normalized)': periodeJabatan,
                  'PHOTO_URL (raw)': photoUrlRaw,
                  'PHOTO_URL (normalized)': photoUrl,
                  'Available Excel columns': Object.keys(row).filter(k => !k.startsWith('_'))
                });
              }

              // PERBAIKAN: Logika prioritas untuk photo_url
              // PRIORITAS 1: Gunakan photo_url dari Excel jika ada
              // PRIORITAS 2: Gunakan photo_url yang sudah ada sebelumnya untuk periode yang SAMA (yang baru dihapus)
              // PRIORITAS 3: JANGAN ambil dari periode lain - biarkan NULL
              // Ini memastikan foto yang di-edit di "Lihat Struktur Organisasi" tetap muncul di "Upload Struktur Organisasi"
              // dan foto dari periode lain tidak ikut ter-copy
              let finalPhotoUrl = photoUrl;
              if (!finalPhotoUrl) {
                // Cek dulu apakah ada foto untuk periode yang sama (sebelum DELETE)
                const existingPhoto = existingPhotos.get(sap);
                if (existingPhoto) {
                  finalPhotoUrl = existingPhoto;
                  daerahFotoDariPeriodeSebelumnya++;
                  console.log(`[bulk-upload] Using preserved photo for ${sap} from same period (${bulanPeriode}/${tahunPeriode}): ${existingPhoto}`);
                } else {
                  // PERBAIKAN: JANGAN ambil foto dari periode lain
                  // Biarkan NULL jika tidak ada di Excel dan tidak ada di periode yang sama
                  // Ini mencegah foto dari periode lain ikut ter-copy
                  finalPhotoUrl = null;
                  console.log(`[bulk-upload] No photo found for ${sap} in Excel or same period, leaving NULL (will not copy from other periods)`);
                }
              }

              // Logging nilai yang akan di-insert (hanya untuk row pertama)
              if (daerahPosisiBerhasil === 0) {
                console.log(`[bulk-upload] Values to INSERT for ${sap}:`, {
                  tingkatan,
                  direktorat,
                  no_hp: noHp,
                  kj_individu: kjIndividu,
                  kj_posisi: kjPosisi,
                  periode_jabatan: periodeJabatan,
                  photo_url_from_excel: photoUrl,
                  photo_url_final: finalPhotoUrl,
                  existing_photo_preserved: existingPhotos.get(sap) || null,
                  photo_from_previous_period: finalPhotoUrl !== photoUrl && finalPhotoUrl ? 'YES' : 'NO'
                });
              }

              await conn.execute(
                `INSERT INTO org_position_nodes
                  (daerah_id, id_posisi_sap, id_posisi_atasan, nama_posisi, nama_jabatan_sap, unit_kerja, nipp, nama, tingkatan, direktorat, photo_url, no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  id_posisi_atasan = VALUES(id_posisi_atasan),
                  nama_posisi = VALUES(nama_posisi),
                  nama_jabatan_sap = VALUES(nama_jabatan_sap),
                  unit_kerja = VALUES(unit_kerja),
                  nipp = VALUES(nipp),
                  nama = VALUES(nama),
                  tingkatan = VALUES(tingkatan),
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
                  kj_posisi = VALUES(kj_posisi)`,
                [
                  daerahId,
                  sap,
                  atasan, // Bisa null jika ID POSISI ATASAN tidak ditemukan
                  jabatan,
                  jabatan,
                  unitKerja,
                  nipp,
                  nama,
                  tingkatan, // Dibaca dari Excel
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

              // Log untuk debugging: pastikan node dengan atasan null tetap tersimpan
              if (!atasan) {
                console.log(`[DEBUG] Row ${rowNumber}: Saved node "${sap}" (${nama || 'N/A'}) without atasan (root node) - Daerah: ${daerahNama}, Periode: ${bulanPeriode}/${tahunPeriode}`);
              }

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
        console.log(`[Bulk Upload] Committed transaction for daerah ${daerahId} (${daerahNama}) - ${daerahPosisiBerhasil} positions saved`);

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
    
    console.log(`[Bulk Upload] Completed - Total: ${totalPosisiBerhasil} success, ${totalPosisiGagal} failed, ${daerahDetails.length} daerah`);
    console.log(`[Bulk Upload] Daerah details:`, daerahDetails.map(d => ({ id: d.daerah_id, nama: d.daerah_nama, posisi: d.total_posisi })));

    return NextResponse.json({
      success: true,
      summary: {
        total_daerah: daerahDetails.length,
        total_posisi: totalRows,
        total_posisi_berhasil: totalPosisiBerhasil,
        total_posisi_gagal: totalPosisiGagal,
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

