import { NextResponse } from 'next/server';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'Nama file diperlukan' },
        { status: 400 }
      );
    }

    // Path to your uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = join(uploadsDir, fileName);
    
    // Debug: Log the file path and check if it exists
    console.log('Looking for file at path:', filePath);
    
    if (!existsSync(filePath)) {
      // List available files for debugging
      const files = existsSync(uploadsDir) ? readdirSync(uploadsDir) : [];
      console.log('Available files in uploads directory:', files);
      
      return NextResponse.json(
        { 
          error: 'File tidak ditemukan',
          details: {
            requestedFile: fileName,
            availableFiles: files,
            uploadsDir
          }
        },
        { status: 404 }
      );
    }
    
    // Read the file as buffer
    const fileBuffer = readFileSync(filePath);
    
    // Check file extension
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'xlsx' || fileExt === 'xls' || fileExt === 'csv') {
      // Parse the file
      const workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        cellDates: true,
        cellText: false,
        cellNF: false 
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Convert to { headers, rows } format
      const [headers, ...rows] = jsonData;
      return NextResponse.json({ headers, rows });
    } else {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Harap unggah file Excel (.xlsx, .xls) atau CSV (.csv)' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { 
        error: 'Gagal membaca file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}