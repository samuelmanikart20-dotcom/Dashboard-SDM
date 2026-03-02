import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';

// Helper function to parse date with comprehensive validation (same as IKT and TCU)
function parseTanggalLahir(dateValue: any): string | null {
  if (!dateValue) return null;
  
  const dateStr = dateValue.toString().trim();
  
  // Skip if empty or contains obviously invalid patterns
  // Accept "-" as valid value for empty date (will be stored as null)
  if (!dateStr || dateStr === "" || dateStr === "NULL" || dateStr === "null" || dateStr === "-") {
    return null;
  }
  
  try {
    // Remove leading/trailing plus signs and spaces
    const cleanDateStr = dateStr.replace(/^\+/, "").trim();
    
    // Check if it's an Excel serial date number
    if (/^\d+\.?\d*$/.test(cleanDateStr) && parseFloat(cleanDateStr) > 0 && parseFloat(cleanDateStr) < 1000000) {
      // Excel date serial number (days since 1900-01-01)
      const excelDate = parseFloat(cleanDateStr);
      // Excel epoch starts from 1900-01-01, but Excel incorrectly treats 1900 as a leap year
      const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
      const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
      if (!isNaN(jsDate.getTime())) {
        const year = jsDate.getFullYear();
        // Validate year is reasonable (1900-2100)
        if (year >= 1900 && year <= 2100) {
          return jsDate.toISOString().split("T")[0];
        }
      }
    }
    
    // If not Excel serial, try parsing as date string
    let tanggalLahir: string | null = null;
    
    // Handle different date formats
    if (cleanDateStr.includes("-")) {
      const parts = cleanDateStr.split("-");
      if (parts.length === 3) {
        // Check if it's DD-MM-YYYY format (like 1-3-1972)
        if (
          parts[2].length === 4 &&
          parts[0].length <= 2 &&
          parts[1].length <= 2
        ) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          // Validate year is reasonable
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const dayStr = parts[0].padStart(2, "0");
            const monthStr = parts[1].padStart(2, "0");
            tanggalLahir = `${year}-${monthStr}-${dayStr}`;
          }
        }
        // Check if it's YYYY-MM-DD format
        else if (
          parts[0].length === 4 &&
          parts[1].length <= 2 &&
          parts[2].length <= 2
        ) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const day = parseInt(parts[2]);
          
          // Validate year is reasonable
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const monthStr = parts[1].padStart(2, "0");
            const dayStr = parts[2].padStart(2, "0");
            tanggalLahir = `${year}-${monthStr}-${dayStr}`;
          }
        }
        // Check if it's DD-MMM-YYYY format (like 23-May-1980)
        else if (parts[2].length === 4 && isNaN(parseInt(parts[1]))) {
          const day = parseInt(parts[0]);
          const monthName = parts[1];
          const year = parseInt(parts[2]);

          // Validate year is reasonable
          if (year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
            // Convert month name to number
            const monthMap: { [key: string]: string } = {
              Jan: "01", January: "01",
              Feb: "02", February: "02",
              Mar: "03", March: "03",
              Apr: "04", April: "04",
              May: "05",
              Jun: "06", June: "06",
              Jul: "07", July: "07",
              Aug: "08", August: "08",
              Sep: "09", September: "09",
              Oct: "10", October: "10",
              Nov: "11", November: "11",
              Dec: "12", December: "12",
            };

            const month = monthMap[monthName];
            if (month) {
              const dayStr = parts[0].padStart(2, "0");
              tanggalLahir = `${year}-${month}-${dayStr}`;
            }
          }
        }
      }
    } else if (cleanDateStr.includes("/")) {
      // Format: 15/8/1985 or 15/08/1985 or 1985/8/15
      const parts = cleanDateStr.split("/");
      if (parts.length === 3) {
        // If first part is 4 digits, it's probably YYYY/MM/DD
        if (parts[0].length === 4) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const day = parseInt(parts[2]);
          
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const monthStr = parts[1].padStart(2, "0");
            const dayStr = parts[2].padStart(2, "0");
            tanggalLahir = `${year}-${monthStr}-${dayStr}`;
          }
        } else {
          // Try DD/MM/YYYY
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const dayStr = parts[0].padStart(2, "0");
            const monthStr = parts[1].padStart(2, "0");
            tanggalLahir = `${year}-${monthStr}-${dayStr}`;
          }
        }
      }
    } else {
      // Try direct parsing for other formats (ISO, etc.)
      const date = new Date(cleanDateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        // Validate year is reasonable
        if (year >= 1900 && year <= 2100) {
          tanggalLahir = date.toISOString().split("T")[0];
        }
      }
    }

    // Final validation: check if the date is valid and reasonable
    if (tanggalLahir) {
      const testDate = new Date(tanggalLahir);
      if (isNaN(testDate.getTime())) {
        tanggalLahir = null;
      } else {
        const year = testDate.getFullYear();
        // Double-check year is reasonable
        if (year < 1900 || year > 2100) {
          tanggalLahir = null;
        }
      }
    }
    
    return tanggalLahir;
  } catch {
    // If parsing fails, return null
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const month = formData.get('month') as string;
    const year = formData.get('year') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: 'Month and year are required' },
        { status: 400 }
      );
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid month value' },
        { status: 400 }
      );
    }

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return NextResponse.json(
        { success: false, error: 'Invalid year value' },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    let data: any[][] = [];

    // Parse file based on type
    if (file.name.endsWith('.csv')) {
      // Parse CSV
      const text = buffer.toString('utf-8');
      const lines = text.split('\n');
      data = lines.map(line => line.split(',').map(cell => cell.trim()));
    } else {
      // Parse Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    }

    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File is empty or invalid' },
        { status: 400 }
      );
    }

    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo',
    });

    try {
      // Create table if it doesn't exist (now includes pendidikan)
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS spmtdata (
          id INT AUTO_INCREMENT PRIMARY KEY,
          npp VARCHAR(50),
          nama VARCHAR(255),
          tanggal_lahir VARCHAR(50),
          jabatan VARCHAR(255),
          entitas VARCHAR(255),
          unit_kerja VARCHAR(255),
          kategori VARCHAR(255),
          jenis_kelamin VARCHAR(50),
          pendidikan VARCHAR(50) NULL,
          organik_non_organik VARCHAR(50),
          pusat_pelayanan VARCHAR(255),
          non_operasional VARCHAR(255),
          status_laporan_rakomdir VARCHAR(255),
          bulan INT DEFAULT NULL,
          tahun INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Ensure pendidikan column exists if table was created earlier without it
      await connection.execute(`
        ALTER TABLE spmtdata
        ADD COLUMN IF NOT EXISTS pendidikan VARCHAR(50) NULL AFTER jenis_kelamin
      `);

      // Update jenis_kelamin column size if it's too small
      try {
        await connection.execute(`
          ALTER TABLE spmtdata
          MODIFY COLUMN jenis_kelamin VARCHAR(50)
        `);
      } catch (alterError) {
        // Column might already be the correct size, ignore error
        console.log('jenis_kelamin column size check:', alterError);
      }

      // Remove status_laporan and rakomdir columns, add status_laporan_rakomdir if needed
      try {
        // Try to drop status_laporan if it exists
        await connection.execute(`
          ALTER TABLE spmtdata
          DROP COLUMN IF EXISTS status_laporan
        `);
      } catch (dropError) {
        console.log('status_laporan column drop check:', dropError);
      }

      try {
        // Try to rename rakomdir to status_laporan_rakomdir if it exists
        await connection.execute(`
          ALTER TABLE spmtdata
          CHANGE COLUMN rakomdir status_laporan_rakomdir VARCHAR(255)
        `);
      } catch {
        // Try to drop rakomdir if rename failed
        try {
          await connection.execute(`
            ALTER TABLE spmtdata
            DROP COLUMN IF EXISTS rakomdir
          `);
        } catch (dropError) {
          console.log('rakomdir column drop check:', dropError);
        }
      }

      // Add status_laporan_rakomdir if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE spmtdata
          ADD COLUMN IF NOT EXISTS status_laporan_rakomdir VARCHAR(255) NULL AFTER non_operasional
        `);
      } catch (addError) {
        // Column might already exist, ignore error
        console.log('status_laporan_rakomdir column check:', addError);
      }

      // Delete existing data for the same month/year before inserting new data
      const deleteResult = await connection.execute(`
        DELETE FROM spmtdata WHERE bulan = ? AND tahun = ?
      `, [monthNum, yearNum]);
      
      const deletedRows = (deleteResult[0] as any).affectedRows || 0;
      console.log(`Deleted ${deletedRows} existing records for ${monthNum}/${yearNum}`);

      const headers = data[0];
      const rows = data.slice(1).filter(row => row.some(cell => cell && cell.toString().trim()));

      // Log headers for debugging
      console.log('Excel Headers:', headers);
      console.log('Expected columns: NPP, NAMA, TANGGAL LAHIR, NAMA JABATAN, ENTITAS, KANTOR PUSAT, KATEGORI, JENIS KELAMIN, PENDIDIKAN, ORGANIK/NON ORGANIK, PUSAT PELAYANAN, NON OPERASIONAL, STATUS LAPORAN RAKOMDIR');

      // Find column indices by header name (case-insensitive, flexible matching)
      // Prioritizes exact phrase matches, then partial matches
      const findColumnIndex = (headerRow: any[], searchTerms: string[], exactPhrase?: string, excludeTerms?: string[]): number => {
        // First, try exact phrase match if provided
        if (exactPhrase) {
          for (let i = 0; i < headerRow.length; i++) {
            const header = (headerRow[i] || '').toString().trim().toLowerCase();
            const exactLower = exactPhrase.toLowerCase();
            // Check if header contains the exact phrase
            if (header.includes(exactLower)) {
              // If exclude terms provided, make sure header doesn't contain them
              if (excludeTerms) {
                const hasExclude = excludeTerms.some(exclude => header.includes(exclude.toLowerCase()));
                if (hasExclude) continue;
              }
              return i;
            }
          }
        }
        
        // Then try individual search terms
        for (let i = 0; i < headerRow.length; i++) {
          const header = (headerRow[i] || '').toString().trim().toLowerCase();
          
          // Skip if header contains exclude terms
          if (excludeTerms) {
            const hasExclude = excludeTerms.some(exclude => header.includes(exclude.toLowerCase()));
            if (hasExclude) continue;
          }
          
          for (const term of searchTerms) {
            const termLower = term.toLowerCase();
            // Prefer matches where the term is a significant part of the header
            if (header === termLower || header.includes(termLower)) {
              return i;
            }
          }
        }
        return -1;
      };

      // Map column indices based on header names
      const colNPP = findColumnIndex(headers, ['npp']);
      const colNama = findColumnIndex(headers, ['nama']);
      const colTanggalLahir = findColumnIndex(headers, ['tanggal', 'lahir', 'tgl']);
      const colJabatan = findColumnIndex(headers, ['jabatan']);
      const colEntitas = findColumnIndex(headers, ['entitas']);
      const colUnitKerja = findColumnIndex(headers, ['unit', 'kerja', 'kantor', 'pusat']);
      const colKategori = findColumnIndex(headers, ['kategori']);
      const colJenisKelamin = findColumnIndex(headers, ['jenis', 'kelamin', 'gender']);
      const colPendidikan = findColumnIndex(headers, ['pendidikan', 'pend']);
      const colOrganik = findColumnIndex(headers, ['organik', 'non organik'], 'jenis pekerja');
      // Pusat Pelayanan: prioritize exact phrase "pusat pelayanan", exclude "unit kerja" and "kantor pusat"
      const colPusatPelayanan = findColumnIndex(headers, ['pelayanan'], 'pusat pelayanan', ['unit kerja', 'kantor pusat', 'branch']);
      // Non Operasional: prioritize "operasional" or "non operasional", exclude "organik"
      const colNonOperasional = findColumnIndex(headers, ['operasional'], 'operasional/non operasional', ['organik', 'jenis pekerja']);
      
      // Try to find status_laporan_rakomdir as single column first
      let colStatusLaporanRakomdir = findColumnIndex(headers, ['status_laporan_rakomdir', 'status laporan rakomdir']);
      
      // If not found, try to find status_laporan and rakomdir separately
      let colStatusLaporan = -1;
      let colRakomdir = -1;
      
      if (colStatusLaporanRakomdir === -1) {
        // Look for status_laporan (but not status_laporan_rakomdir)
        colStatusLaporan = findColumnIndex(headers, ['status_laporan', 'status laporan']);
        // If found status_laporan, check if it's actually status_laporan_rakomdir
        if (colStatusLaporan >= 0) {
          const headerAtStatusLaporan = (headers[colStatusLaporan] || '').toString().trim().toLowerCase();
          if (headerAtStatusLaporan.includes('rakomdir') || headerAtStatusLaporan.includes('rakom')) {
            colStatusLaporanRakomdir = colStatusLaporan;
            colStatusLaporan = -1;
          }
        }
        
        // Look for rakomdir separately (only if status_laporan_rakomdir not found)
        if (colStatusLaporanRakomdir === -1) {
          colRakomdir = findColumnIndex(headers, ['rakomdir', 'rakom']);
        }
      }

      // Fallback to positional mapping if header-based mapping fails
      const usePositionalMapping = colNPP === -1 || colNama === -1;

      if (usePositionalMapping) {
        console.warn('Header-based mapping failed, using positional mapping (row[0], row[1], ...)');
      } else {
        console.log('Column mapping:', {
          NPP: colNPP, Nama: colNama, TanggalLahir: colTanggalLahir, Jabatan: colJabatan,
          Entitas: colEntitas, UnitKerja: colUnitKerja, Kategori: colKategori,
          JenisKelamin: colJenisKelamin, Pendidikan: colPendidikan, Organik: colOrganik,
          PusatPelayanan: colPusatPelayanan, NonOperasional: colNonOperasional,
          StatusLaporanRakomdir: colStatusLaporanRakomdir,
          StatusLaporan: colStatusLaporan,
          Rakomdir: colRakomdir
        });
      }

      let inserted = 0;
      let errors = 0;
      const errorDetails = [] as Array<{
        row: number;
        column?: string;
        value?: string;
        reason: string;
      }>;

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const excelRowNumber = i + 2; // Excel row number (accounting for header row)
        let rowData: any = null; // Declare outside try block for error handling
        
        try {
          // Skip empty rows
          if (!row || row.length < 3) {
            if (row && row.some(cell => cell && cell.toString().trim())) {
              // Row has some data but not enough columns
              errorDetails.push({
                row: excelRowNumber,
                reason: 'Baris tidak lengkap (kurang dari 3 kolom)',
                value: row.slice(0, 3).join(', ')
              });
              errors++;
            }
            continue;
          }

          // Map row data based on header-based or positional mapping
          const getCell = (index: number, fallbackIndex: number): string => {
            if (index >= 0 && row[index] !== undefined && row[index] !== null) {
              return (row[index] || '').toString().trim();
            }
            if (fallbackIndex >= 0 && row[fallbackIndex] !== undefined && row[fallbackIndex] !== null) {
              return (row[fallbackIndex] || '').toString().trim();
            }
            return '';
          };

          const jenisKelaminRaw = usePositionalMapping 
            ? (row[7] || '').toString().trim()
            : getCell(colJenisKelamin, 7);
          
          // Normalize jenis_kelamin: truncate to 50 chars max and normalize common values
          let jenisKelaminNormalized = jenisKelaminRaw;
          
          // Normalize common gender values (case-insensitive)
          const jenisKelaminLower = jenisKelaminRaw.toLowerCase();
          if (jenisKelaminLower === 'l' || jenisKelaminLower === 'laki-laki' || jenisKelaminLower === 'lakilaki' || jenisKelaminLower.startsWith('laki')) {
            jenisKelaminNormalized = 'L';
          } else if (jenisKelaminLower === 'p' || jenisKelaminLower === 'perempuan' || jenisKelaminLower === 'wanita' || jenisKelaminLower.startsWith('perempuan')) {
            jenisKelaminNormalized = 'P';
          } else {
            // If not normalized, truncate to 50 chars max
            jenisKelaminNormalized = jenisKelaminRaw.substring(0, 50);
          }

          // Parse tanggal lahir with comprehensive validation
          const tanggalLahirRaw = usePositionalMapping ? row[2] : (colTanggalLahir >= 0 ? row[colTanggalLahir] : row[2]);
          const tanggalLahirParsed = parseTanggalLahir(tanggalLahirRaw);
          
          rowData = {
            npp: usePositionalMapping ? (row[0] || '').toString().trim() : getCell(colNPP, 0),
            nama: usePositionalMapping ? (row[1] || '').toString().trim() : getCell(colNama, 1),
            tanggal_lahir: tanggalLahirParsed || '',
            jabatan: usePositionalMapping ? (row[3] || '').toString().trim() : getCell(colJabatan, 3),
            entitas: usePositionalMapping ? (row[4] || '').toString().trim() : getCell(colEntitas, 4),
            unit_kerja: usePositionalMapping ? (row[5] || '').toString().trim() : getCell(colUnitKerja, 5),
            kategori: usePositionalMapping ? (row[6] || '').toString().trim() : getCell(colKategori, 6),
            jenis_kelamin: jenisKelaminNormalized,
            pendidikan: usePositionalMapping ? (row[8] || '').toString().trim() : getCell(colPendidikan, 8),
            organik_non_organik: usePositionalMapping ? (row[9] || '').toString().trim() : getCell(colOrganik, 9),
            pusat_pelayanan: usePositionalMapping ? (row[10] || '').toString().trim() : getCell(colPusatPelayanan, 10),
            non_operasional: usePositionalMapping ? (row[11] || '').toString().trim() : getCell(colNonOperasional, 11),
            status_laporan_rakomdir: (() => {
              if (usePositionalMapping) {
                // For positional mapping: try to combine col 12 and 13 if both exist
                const col12 = (row[12] || '').toString().trim();
                const col13 = (row[13] || '').toString().trim();
                if (col12 && col13) {
                  return `${col12} ${col13}`.trim();
                }
                return col12 || col13;
              } else {
                // For header-based mapping
                if (colStatusLaporanRakomdir >= 0) {
                  // Single column found
                  return getCell(colStatusLaporanRakomdir, 12);
                } else if (colStatusLaporan >= 0 && colRakomdir >= 0) {
                  // Both columns found separately, combine them
                  const statusLaporan = getCell(colStatusLaporan, 12);
                  const rakomdir = getCell(colRakomdir, 13);
                  return `${statusLaporan} ${rakomdir}`.trim();
                } else if (colStatusLaporan >= 0) {
                  // Only status_laporan found
                  return getCell(colStatusLaporan, 12);
                } else if (colRakomdir >= 0) {
                  // Only rakomdir found
                  return getCell(colRakomdir, 13);
                } else {
                  // Fallback to positional
                  return (row[12] || '').toString().trim();
                }
              }
            })()
          };
          if (i === 0) {
            console.log('First row data mapped:', rowData);
          }

          // Validate required fields
          if (!rowData.npp || !rowData.nama) {
            const missingFields = [];
            if (!rowData.npp) missingFields.push('NPP');
            if (!rowData.nama) missingFields.push('NAMA');
            
            errorDetails.push({
              row: excelRowNumber,
              column: missingFields.join(', '),
              reason: `Kolom tidak boleh kosong: ${missingFields.join(', ')}`,
              value: `NPP: "${rowData.npp || ''}", NAMA: "${rowData.nama || ''}"`
            });
            errors++;
            continue;
          }
          
          // Validate tanggal_lahir if provided
          // Accept "-" as valid value for empty date
          const tanggalLahirRawStr = String(tanggalLahirRaw || '').trim();
          if (tanggalLahirRawStr && tanggalLahirRawStr !== "-" && !tanggalLahirParsed) {
            errorDetails.push({
              row: excelRowNumber,
              column: 'TANGGAL LAHIR',
              value: tanggalLahirRawStr,
              reason: 'Format tanggal lahir tidak valid atau tahun di luar rentang 1900-2100'
            });
            errors++;
            continue;
          }

          // Insert into database (includes pendidikan)
          await connection.execute(`
            INSERT INTO spmtdata (
              npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
              kategori, jenis_kelamin, pendidikan, organik_non_organik,
              pusat_pelayanan, non_operasional, status_laporan_rakomdir, bulan, tahun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            rowData.npp, rowData.nama, rowData.tanggal_lahir, rowData.jabatan,
            rowData.entitas, rowData.unit_kerja,
            rowData.kategori, rowData.jenis_kelamin, rowData.pendidikan, rowData.organik_non_organik,
            rowData.pusat_pelayanan, rowData.non_operasional, rowData.status_laporan_rakomdir,
            monthNum, yearNum
          ]);

          inserted++;
        } catch (error) {
          console.error(`Error inserting row ${excelRowNumber}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Try to identify which column caused the error
          let problematicColumn = 'Tidak diketahui';
          let problematicValue = '';
          
          if (errorMessage.includes('npp') || errorMessage.includes('NPP')) {
            problematicColumn = 'NPP';
            problematicValue = rowData?.npp || row[0]?.toString() || '';
          } else if (errorMessage.includes('nama') || errorMessage.includes('NAMA')) {
            problematicColumn = 'NAMA';
            problematicValue = rowData?.nama || row[1]?.toString() || '';
          } else if (errorMessage.includes('tanggal') || errorMessage.includes('date')) {
            problematicColumn = 'TANGGAL LAHIR';
            problematicValue = rowData?.tanggal_lahir || row[2]?.toString() || '';
          } else if (errorMessage.includes('duplicate') || errorMessage.includes('Duplicate')) {
            problematicColumn = 'NPP';
            problematicValue = rowData?.npp || row[0]?.toString() || '';
          }
          
          errorDetails.push({
            row: excelRowNumber,
            column: problematicColumn,
            value: problematicValue || 'N/A',
            reason: errorMessage.includes('Duplicate') 
              ? 'Data duplikat (NPP sudah ada di database)'
              : errorMessage
          });
          errors++;
        }
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        message: `Data uploaded successfully for ${monthNum}/${yearNum}. ${inserted} records inserted.`,
        totalRecords: rows.length,
        inserted,
        updated: 0,
        errors,
        errorDetails: errors > 0 ? errorDetails : undefined,
        month: monthNum,
        year: yearNum
      });

    } catch (dbError) {
      await connection.end();
      throw dbError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process file',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
