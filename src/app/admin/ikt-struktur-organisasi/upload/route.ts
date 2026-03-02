
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { read, utils } from 'xlsx';

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
    // Coba parse sebagai Date object (untuk format ISO 8601 atau format lainnya)
    const date = new Date(dateValue);
    
    // Cek apakah date valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Konversi ke format YYYY-MM-DD
    const year = date.getFullYear();
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

async function ensureTableColumns(conn: mysql.Connection) {
  // Check existing columns
  const [cols]: any = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'struktur_organisasi_ikt'`,
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

  // Update unique key to include bulan and tahun if needed
  if (!have.has('bulan') || !have.has('tahun')) {
    try {
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt DROP INDEX IF EXISTS uniq_daerah_id_sap_ikt`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt ADD UNIQUE KEY uniq_daerah_id_sap_periode_ikt (daerah_id, id_posisi_sap, bulan, tahun)`);
      await conn.execute(`ALTER TABLE struktur_organisasi_ikt ADD INDEX idx_periode_ikt (bulan, tahun)`);
    } catch (e: any) {
      console.log('Index update skipped:', e.message);
    }
  }
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
  
  // 5. Fuzzy match - cari nama yang mengandung kata kunci utama
  const keywords = daerahUpper.split(/\s+/).filter(k => k.length > 2 && k !== 'SPMT' && k !== 'PTP' && k !== 'IKT');
  if (keywords.length > 0) {
    const primaryKeyword = keywords.sort((a, b) => b.length - a.length)[0];
    
    let bestMatch: { id: number; score: number } | null = null;
    
    for (const row of daerahRows) {
      const dbNama = normalize(String(row.nama || ''));
      const dbKode = normalize(String(row.kode || ''));
      const dbNamaWithoutPrefix = dbNama.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim();
      
      let score = 0;
      
      if (dbNama.includes(primaryKeyword) || dbKode.includes(primaryKeyword)) {
        score += 10;
        
        const matchedKeywords = keywords.filter(keyword => 
          dbNama.includes(keyword) || dbKode.includes(keyword) || dbNamaWithoutPrefix.includes(keyword)
        );
        score += matchedKeywords.length * 5;
        
        if (matchedKeywords.length === keywords.length) {
          score += 20;
        }
        
        if (normalize(dbNamaWithoutPrefix) === normalize(namaWithoutPrefix)) {
          score += 30;
        }
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: row.id, score };
      }
    }
    
    if (bestMatch && bestMatch.score >= 15) {
      return bestMatch.id;
    }
  }
  
  return null;
}

// Deteksi kolom DIREKTORAT dengan variasi nama (prioritas untuk IKT)
function detectDirektoratColumn(headers: string[]): string | null {
  const variants = ['DIREKTORAT', 'DIRECTORATE', 'DIVISI', 'DIVISION', 'DEPARTMENT'];
  for (const variant of variants) {
    if (headers.includes(variant)) {
      return variant;
    }
  }
  return null;
}

// Deteksi kolom DAERAH dengan variasi nama (fallback)
function detectDaerahColumn(headers: string[]): string | null {
  const daerahVariants = ['DAERAH', 'DAERAH_ID', 'KODE DAERAH', 'NAMA DAERAH', 'KODE_DAERAH', 'NAMA_DAERAH', 'UNIT KERJA', 'UNIT_KERJA'];
  for (const variant of daerahVariants) {
    if (headers.includes(variant)) {
      return variant;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let connection;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const daerahId = formData.get('daerah_id') as string;
    const bulan = formData.get('bulan') as string;
    const tahun = formData.get('tahun') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File wajib diisi' },
        { status: 400 }
      );
    }

    // Validasi bulan dan tahun
    if (!bulan || !tahun || bulan === 'all' || tahun === 'all') {
      return NextResponse.json(
        { error: 'bulan dan tahun wajib diisi' },
        { status: 400 }
      );
    }

    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
      return NextResponse.json(
        { error: 'bulan dan tahun tidak valid' },
        { status: 400 }
      );
    }

    // Cek tipe file Excel
    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'File harus bertipe .xlsx' },
        { status: 400 }
      );
    }

    // Parsing Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<any>(sheet);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'File Excel kosong atau tidak valid' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);
    await ensureTableColumns(connection);

    // PERBAIKAN: Pastikan tabel ikt_daerah ada
    try {
      await connection.execute(`
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

    // Get headers untuk deteksi kolom DIREKTORAT (prioritas untuk IKT) atau DAERAH (fallback)
    const headers = Object.keys(data[0] || {});
    const direktoratColumn = detectDirektoratColumn(headers);
    const daerahColumn = detectDaerahColumn(headers);
    
    // Prioritas: DIREKTORAT > DAERAH
    const mappingColumn = direktoratColumn || daerahColumn;
    const hasMappingColumn = !!mappingColumn;
    const usingDirektorat = !!direktoratColumn;

    // Jika tidak ada kolom DIREKTORAT atau DAERAH, daerah_id dari form wajib diisi
    if (!hasMappingColumn && !daerahId) {
      await connection.end();
      return NextResponse.json(
        { error: 'Kolom DIREKTORAT atau DAERAH tidak ditemukan di Excel. Silakan tambahkan kolom DIREKTORAT/DAERAH di Excel atau isi daerah_id di form.' },
        { status: 400 }
      );
    }

    // PERBAIKAN: Get mapping daerah dari database (ikt_daerah) - bukan daerah
    const [daerahRows]: any = await connection.execute('SELECT id, nama, kode FROM ikt_daerah ORDER BY id');
    const daerahMap = new Map<string, number>();
    const daerahNameMap = new Map<string, number>();
    
    // Build maps dengan berbagai variasi untuk fleksibilitas maksimal
    for (const row of daerahRows as any[]) {
      const kode = String(row.kode || '').trim();
      const nama = String(row.nama || '').trim();
      
      if (kode) {
        daerahMap.set(kode.toUpperCase(), row.id);
      }
      
      if (nama) {
        const namaUpper = nama.toUpperCase().trim();
        const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, '');
        daerahNameMap.set(namaUpper, row.id);
        daerahNameMap.set(namaNormalized, row.id);
        daerahNameMap.set(namaUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), row.id);
        daerahNameMap.set(namaNormalized.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), row.id);
      }
    }

    // Validasi daerah_id dari form jika tidak ada kolom mapping
    let defaultDaerahId: number | null = null;
    if (!hasMappingColumn) {
      const daerahIdNum = typeof daerahId === 'string' ? parseInt(daerahId) : daerahId;
      if (isNaN(daerahIdNum)) {
        await connection.end();
        return NextResponse.json(
          { error: `daerah_id ${daerahId} tidak valid` },
          { status: 400 }
        );
      }
      
      const [daerahCheck] = await connection.execute(
        'SELECT id FROM ikt_daerah WHERE id = ?',
        [daerahIdNum]
      );
      if (!Array.isArray(daerahCheck) || daerahCheck.length === 0) {
        await connection.end();
        return NextResponse.json(
          { error: `daerah_id ${daerahIdNum} tidak ditemukan di tabel ikt_daerah. Pastikan daerah IKT sudah ada di sistem.` },
          { status: 400 }
        );
      }
      defaultDaerahId = daerahIdNum;
    }

    // Group rows by daerah untuk menghapus data lama per daerah
    const rowsByDaerah = new Map<number, any[]>();
    const errors: any[] = [];

    // Process each row dan group by daerah
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      let rowDaerahId: number | null = null;
      
      if (hasMappingColumn) {
        // Cari daerah_id berdasarkan kolom DIREKTORAT atau DAERAH di Excel
        const mappingValue = String(row[mappingColumn!] || '').trim();
        if (mappingValue) {
          rowDaerahId = findDaerahId(mappingValue, daerahMap, daerahNameMap, daerahRows as any[]);
          if (!rowDaerahId && usingDirektorat) {
            // Jika menggunakan DIREKTORAT dan tidak ditemukan, coba buat entry baru
            // Generate kode dari nama direktorat
            const cleanName = mappingValue.trim();
            const kodeBaru = cleanName
              .toUpperCase()
              .replace(/[^A-Z0-9\s]/g, '')
              .trim()
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 4) || 'DIR';
            
            try {
              // Cek apakah kode sudah ada
              const [existingKode] = await connection.execute(
                'SELECT id FROM ikt_daerah WHERE kode = ?',
                [kodeBaru]
              );
              
              let finalKode = kodeBaru;
              if (Array.isArray(existingKode) && existingKode.length > 0) {
                // Jika kode sudah ada, tambahkan angka
                let counter = 1;
                while (true) {
                  const [checkKode] = await connection.execute(
                    'SELECT id FROM ikt_daerah WHERE kode = ?',
                    [`${kodeBaru}${counter}`]
                  );
                  if (!Array.isArray(checkKode) || checkKode.length === 0) {
                    finalKode = `${kodeBaru}${counter}`;
                    break;
                  }
                  counter++;
                }
              }
              
              // Buat entry baru
              const [result] = await connection.execute(
                'INSERT INTO ikt_daerah (nama, kode) VALUES (?, ?)',
                [cleanName, finalKode]
              );
              
              const newId = (result as any).insertId;
              if (newId) {
                rowDaerahId = newId;
                // Update maps
                daerahRows.push({ id: newId, nama: cleanName, kode: finalKode });
                daerahMap.set(finalKode.toUpperCase(), newId);
                const namaUpper = cleanName.toUpperCase().trim();
                const namaNormalized = namaUpper.replace(/\s+/g, ' ').replace(/-/g, '');
                daerahNameMap.set(namaUpper, newId);
                daerahNameMap.set(namaNormalized, newId);
                daerahNameMap.set(namaUpper.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), newId);
                daerahNameMap.set(namaNormalized.replace(/^(SPMT|PTP|IKT)\s+/i, '').trim(), newId);
                console.log(`[IKT Upload] Created new direktorat entry "${cleanName}" with daerah_id ${newId}`);
              }
            } catch (createError: any) {
              console.error(`[IKT Upload] Error creating new direktorat entry:`, createError);
              errors.push({
                row: i + 2,
                error: `Gagal membuat entry baru untuk direktorat "${mappingValue}": ${createError.message}`,
                daerah: mappingValue
              });
              continue;
            }
          }
          
          if (!rowDaerahId) {
            errors.push({
              row: i + 2,
              error: usingDirektorat 
                ? `Direktorat "${mappingValue}" tidak ditemukan di database dan gagal dibuat`
                : `Daerah "${mappingValue}" tidak ditemukan di database`,
              daerah: mappingValue
            });
            continue;
          }
        } else {
          errors.push({
            row: i + 2,
            error: usingDirektorat ? 'Kolom DIREKTORAT kosong' : 'Kolom DAERAH kosong',
            daerah: '(tidak ada)'
          });
          continue;
        }
      } else {
        // Gunakan default daerah_id dari form
        rowDaerahId = defaultDaerahId!;
      }

      // Add to group
      if (!rowsByDaerah.has(rowDaerahId)) {
        rowsByDaerah.set(rowDaerahId, []);
      }
      rowsByDaerah.get(rowDaerahId)!.push(row);
    }

    // Process each daerah
    let totalPosisiBerhasil = 0;
    const daerahDetails: any[] = [];

    for (const [daerahId, rows] of rowsByDaerah.entries()) {
      // Hapus data lama untuk daerah dan periode ini
      await connection.execute(
        'DELETE FROM struktur_organisasi_ikt WHERE daerah_id = ? AND bulan = ? AND tahun = ?',
        [daerahId, bulanInt, tahunInt]
      );

      // Get daerah name
      const [daerahInfo]: any = await connection.execute('SELECT nama FROM ikt_daerah WHERE id = ?', [daerahId]);
      const daerahNama = (daerahInfo as any[])[0]?.nama || `Daerah ID ${daerahId}`;

      // Insert data baru untuk daerah ini
      for (const row of rows) {
        try {
          await connection.execute(
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
              row["ID POSISI SAP"],
              row["ID POSISI ATASAN"] || null,
              daerahId,
              row["NAMA"] || row["JABATAN"] || null,
              row["JABATAN"] || null,
              row["UNIT KERJA"] || null,
              row["NIPP"] || null,
              // PERBAIKAN: Ambil direktorat dengan berbagai variasi nama kolom
              // Jika direktorat kosong, coba ambil dari unit_kerja atau dari mapping column
              (() => {
                const rowKeys = Object.keys(row);
                const direktoratKey = rowKeys.find(k => 
                  k.toUpperCase().trim() === 'DIREKTORAT' || 
                  k.toUpperCase().trim() === 'DIRECTORATE' ||
                  k.toUpperCase().trim() === 'DIVISI' ||
                  k.toUpperCase().trim() === 'DIVISION'
                );
                
                let direktoratValue = null;
                if (direktoratKey) {
                  direktoratValue = row[direktoratKey];
                } else {
                  direktoratValue = row["DIREKTORAT"] || row["direktorat"] || row["Direktorat"] || null;
                }
                
                // Jika direktorat kosong, coba ambil dari unit_kerja
                if (!direktoratValue || String(direktoratValue).trim() === '') {
                  const unitKerja = row["UNIT KERJA"] || row["unit kerja"] || row["Unit Kerja"] || null;
                  if (unitKerja && String(unitKerja).trim() !== '') {
                    direktoratValue = unitKerja;
                  } else if (usingDirektorat && mappingColumn) {
                    // Jika menggunakan direktorat sebagai fallback untuk mapping, gunakan nilai dari mapping column
                    direktoratValue = row[mappingColumn] || null;
                  }
                }
                
                return normalizeValue(direktoratValue);
              })(),
              row["PHOTO_URL"] || null,
              // PERBAIKAN: Ambil semua field dengan berbagai variasi nama kolom (case-insensitive)
              normalizeValue(getFieldFromRow(row, ["NO HP", "NO. HP", "NO_HP", "no_hp", "No. HP", "no hp", "No HP", "HANDHPONE", "handphone", "HP", "hp"])),
              formatDateForMySQL(normalizeValue(getFieldFromRow(row, ["TMT JABATAN", "TMT_JABATAN", "tmt_jabatan", "Tmt Jabatan", "tmt jabatan", "TMT"]))),
              normalizeValue(getFieldFromRow(row, ["PERIODE JABATAN", "PERIODE_JABATAN", "periode_jabatan", "Periode Jabatan", "periode jabatan", "PERIODE"])),
              normalizeValue(getFieldFromRow(row, ["KJ INDIVIDU", "KJ_INDIVIDU", "kj_individu", "Kj Individu", "kj individu", "KJINDIVIDU"])),
              normalizeValue(getFieldFromRow(row, ["KJ POSISI", "KJ_POSISI", "kj_posisi", "Kj Posisi", "kj posisi", "KJPOSISI"])),
              bulanInt,
              tahunInt
            ]
          );
          totalPosisiBerhasil++;
        } catch (rowError: any) {
          errors.push({
            row: data.indexOf(row) + 2,
            error: rowError.message || 'Gagal insert row',
            daerah: daerahNama
          });
        }
      }

      daerahDetails.push({
        daerah_id: daerahId,
        daerah_nama: daerahNama,
        total_posisi: rows.length
      });
    }

    return NextResponse.json({ 
      success: true,
      summary: {
        total_daerah: daerahDetails.length,
        total_posisi_berhasil: totalPosisiBerhasil,
        total_posisi_gagal: errors.length,
        daerah_details: daerahDetails,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Gagal upload dan parsing file Excel' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
