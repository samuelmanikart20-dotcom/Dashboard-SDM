import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

// GET - Get RKAP values for a specific month and year
export async function GET(request: NextRequest) {
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
        { success: false, error: 'Bulan tidak valid' },
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
    
    // Check if table exists, if not return empty object
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'rkap_sdm'"
    );
    
    if (Array.isArray(tables) && tables.length === 0) {
      return NextResponse.json({
        success: true,
        data: {}
      });
    }
    
    // Check if 'bulan' column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM rkap_sdm LIKE 'bulan'"
    );
    
    let rows: any[];
    if (Array.isArray(columns) && columns.length > 0) {
      // Column exists, use new query with bulan
      const [result] = await connection.execute(
        'SELECT kategori, nilai FROM rkap_sdm WHERE bulan = ? AND tahun = ?',
        [bulanInt, tahunInt]
      );
      rows = Array.isArray(result) ? result : [];
    } else {
      // Column doesn't exist, use old query (for backward compatibility)
      const [result] = await connection.execute(
        'SELECT kategori, nilai FROM rkap_sdm WHERE tahun = ?',
        [tahunInt]
      );
      rows = Array.isArray(result) ? result : [];
    }
    
    const result: { [key: string]: number } = {};
    (rows as any[]).forEach((row: any) => {
      result[row.kategori] = row.nilai;
    });
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error fetching RKAP SDM:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data RKAP SDM' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// POST/PUT - Save or update RKAP values
export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { bulan, tahun, data } = body;
    
    if (!bulan || !tahun || !data) {
      return NextResponse.json(
        { success: false, error: 'Bulan, tahun dan data wajib diisi' },
        { status: 400 }
      );
    }
    
    const bulanInt = parseInt(bulan);
    const tahunInt = parseInt(tahun);
    
    if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
      return NextResponse.json(
        { success: false, error: 'Bulan tidak valid' },
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
    
    // Ensure table exists with new structure
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rkap_sdm (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kategori VARCHAR(255) NOT NULL,
        bulan INT NOT NULL,
        tahun INT NOT NULL,
        nilai INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_kategori_bulan_tahun (kategori, bulan, tahun),
        INDEX idx_tahun (tahun),
        INDEX idx_bulan_tahun (bulan, tahun),
        INDEX idx_kategori (kategori)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Check if 'bulan' column exists, if not add it (migration for existing tables)
    try {
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM rkap_sdm LIKE 'bulan'"
      );
      
      if (Array.isArray(columns) && columns.length === 0) {
        // Column doesn't exist, add it
        console.log('[RKAP SDM] Migrating table: adding bulan column');
        
        // Add bulan column
        await connection.execute(`
          ALTER TABLE rkap_sdm 
          ADD COLUMN bulan INT NOT NULL DEFAULT 1 AFTER kategori
        `);
        
        // Update existing records
        await connection.execute(`
          UPDATE rkap_sdm SET bulan = 1 WHERE bulan IS NULL OR bulan = 0
        `);
        
        // Drop old unique key if exists
        try {
          await connection.execute(`
            ALTER TABLE rkap_sdm DROP INDEX unique_kategori_tahun
          `);
        } catch (e: any) {
          // Index might not exist, ignore error
          if (!e.message.includes("Unknown key")) {
            console.warn('[RKAP SDM] Could not drop old index:', e.message);
          }
        }
        
        // Add new unique key
        try {
          await connection.execute(`
            ALTER TABLE rkap_sdm 
            ADD UNIQUE KEY unique_kategori_bulan_tahun (kategori, bulan, tahun)
          `);
        } catch (e: any) {
          // Key might already exist
          if (!e.message.includes("Duplicate key")) {
            console.warn('[RKAP SDM] Could not add new unique key:', e.message);
          }
        }
        
        // Add index for bulan_tahun
        try {
          await connection.execute(`
            ALTER TABLE rkap_sdm 
            ADD INDEX idx_bulan_tahun (bulan, tahun)
          `);
        } catch (e: any) {
          // Index might already exist
          if (!e.message.includes("Duplicate key")) {
            console.warn('[RKAP SDM] Could not add bulan_tahun index:', e.message);
          }
        }
        
        console.log('[RKAP SDM] Migration completed successfully');
      }
    } catch (migrationError) {
      console.error('[RKAP SDM] Migration error (non-fatal):', migrationError);
      // Continue even if migration fails, table creation should handle it
    }
    
    // Save or update each category
    const categories = Object.keys(data);
    let savedCount = 0;
    
    for (const kategori of categories) {
      const nilai = parseInt(data[kategori]) || 0;
      
      await connection.execute(
        `INSERT INTO rkap_sdm (kategori, bulan, tahun, nilai) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nilai = ?, updated_at = CURRENT_TIMESTAMP`,
        [kategori, bulanInt, tahunInt, nilai, nilai]
      );
      savedCount++;
    }
    
    const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan ${savedCount} nilai RKAP untuk ${bulanNames[bulanInt - 1]} ${tahunInt}`,
      savedCount
    });
    
  } catch (error) {
    console.error('Error saving RKAP SDM:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menyimpan data RKAP SDM' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}



