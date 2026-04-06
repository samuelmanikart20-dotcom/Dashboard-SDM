import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unitKerja = searchParams.get('unit_kerja');
    
    if (!unitKerja || unitKerja === 'all') {
      let connection;
      
      try {
        connection = await mysql.createConnection(dbConfig);
        
        const [rows] = await connection.execute(`
          SELECT 
            pso.id,
            pso.ptp_daerah_id as daerah_id,
            pso.image_url,
            pso.file_name,
            pso.uploaded_at,
            pd.nama as nama_daerah,
            pd.kode as kode_daerah
          FROM ptp_struktur_organisasi pso
          JOIN ptp_daerah pd ON pso.ptp_daerah_id = pd.id
          ORDER BY pso.uploaded_at DESC
        `);
        
        return NextResponse.json({
          success: true,
          data: rows
        });
        
      } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to fetch PTP organizational structures' 
          },
          { status: 500 }
        );
      } finally {
        if (connection) {
          await connection.end();
        }
      }
    }

    // Map unit kerja to potential image names with priority order
    const unitKerjaMapping: { [key: string]: string[] } = {
      'PTP-KANTOR PUSAT': ['kantor_pusat', 'pusat', 'kp'],
      'PTP-CABANG TANJUNG PRIOK': ['tanjung_priok', 'priok', 'tp'],
      'PTP-CABANG BANTEN': ['banten', 'btn'],
      'PTP-CABANG CIREBON': ['cirebon', 'crb'],
      'PTP-CABANG PANGKA BALAM': ['pangka_balam', 'pangka', 'pb'],
      'PTP-CABANG TANJUNG BALAM': ['tanjung_balam', 'tb'],
      'PTP-CABANG PALEMBANG': ['palembang', 'plg'],
      'PTP-CABANG TELUK BAYUR': ['teluk_bayur', 'bayur'],
      'PTP-CABANG PANJANG': ['panjang', 'pjg'],
      'PTP-CABANG BENGKULU': ['bengkulu', 'bkl'],
      'PTP-CABANG JAMBI': ['jambi', 'jmb'],
      'PTP-CABANG PONTIANAK': ['pontianak', 'ptk']
    };

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'ptp-struktur-organisasi');
    
    // Check if directory exists
    if (!fs.existsSync(uploadsDir)) {
      return NextResponse.json({
        success: true,
        data: null
      });
    }

    // Get all files in the directory
    const files = fs.readdirSync(uploadsDir);
    
    // Find matching file based on unit kerja with priority matching
    let matchedFile = null;
    const searchTerms = unitKerjaMapping[unitKerja] || [unitKerja.toLowerCase().replace(/ptp-cabang-?/i, '').replace(/ptp-?/i, '')];
    
    // First pass: Look for exact matches with highest priority terms
    for (const term of searchTerms) {
      for (const file of files) {
        const fileName = file.toLowerCase();
        
        // Check for exact term match (highest priority)
        if (fileName.includes(term.toLowerCase())) {
          matchedFile = file;
          break;
        }
      }
      
      if (matchedFile) break;
    }

    // Second pass: If no match found, try partial matching
    if (!matchedFile) {
      for (const file of files) {
        const fileName = file.toLowerCase();
        
        // Extract region name from unit kerja for partial matching
        let regionName = unitKerja.toLowerCase();
        regionName = regionName.replace(/ptp-cabang-?/i, '').replace(/ptp-?/i, '');
        regionName = regionName.replace(/kantor pusat/i, 'KP');
        
        if (fileName.includes(regionName)) {
          matchedFile = file;
          break;
        }
      }
    }

    // Third pass: If still no match, get the most recent file as fallback
    if (!matchedFile && files.length > 0) {
      const filesWithStats = files.map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return { file, mtime: stats.mtime };
      });
      
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      matchedFile = filesWithStats[0].file;
    }

    if (!matchedFile) {
      return NextResponse.json({
        success: true,
        data: null
      });
    }

    // Return the structure data
    const structureData = {
      id: 1,
      unit_kerja: unitKerja,
      image_url: `/uploads/ptp-struktur-organisasi/${matchedFile}`,
      file_name: matchedFile,
      uploaded_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: structureData
    });

  } catch (error) {
    console.error('Error fetching PTP struktur organisasi:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PTP struktur organisasi' },
      { status: 500 }
    );
  }
}
