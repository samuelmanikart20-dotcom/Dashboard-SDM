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
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spmt_pelindo_revisi',
      port: Number(process.env.DB_PORT) || 3307,
    });

    try {
      // Create table if it doesn't exist (add pendidikan column)
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ptpdata (
          id INT AUTO_INCREMENT PRIMARY KEY,
          npp VARCHAR(50),
          nama VARCHAR(255),
          tanggal_lahir VARCHAR(50),
          jabatan VARCHAR(255),
          entitas VARCHAR(255),
          unit_kerja VARCHAR(255),
          kategori VARCHAR(255),
          jenis_kelamin VARCHAR(10),
          pendidikan VARCHAR(50) NULL,
          organik_non_organik VARCHAR(50),
          pusat_pelayanan VARCHAR(255),
          non_operasional VARCHAR(255),
          status_laporan VARCHAR(255),
          bulan INT DEFAULT NULL,
          tahun INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_jenis_kelamin (jenis_kelamin),
          INDEX idx_entitas (entitas),
          INDEX idx_jabatan (jabatan),
          INDEX idx_organik_non_organik (organik_non_organik),
          INDEX idx_bulan_tahun (bulan, tahun),
          INDEX idx_npp (npp),
          INDEX idx_unit_kerja (unit_kerja)
        )
      `);

      // Ensure pendidikan column exists for legacy tables
      const [colRows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ptpdata' AND COLUMN_NAME = 'pendidikan'`
      );
      const hasPendidikan = (colRows as any)[0]?.cnt > 0;
      if (!hasPendidikan) {
        await connection.execute(`
          ALTER TABLE ptpdata
          ADD COLUMN pendidikan VARCHAR(50) NULL AFTER jenis_kelamin
        `);
      }

      // Delete existing data for the same month/year before inserting new data
      const deleteResult = await connection.execute(`
        DELETE FROM ptpdata WHERE bulan = ? AND tahun = ?
      `, [monthNum, yearNum]);
      
      const deletedRows = (deleteResult[0] as any).affectedRows || 0;
      console.log(`Deleted ${deletedRows} existing PTP records for ${monthNum}/${yearNum}`);

      const rows = data.slice(1).filter(row => row.some(cell => cell && cell.toString().trim()));

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
        let rowData: any = null; // Declare in outer scope for error handling
        
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

          // Map row data based on PTP Excel/CSV format (CORRECTED based on actual Excel structure from image):
          // A: NPP, B: NAMA, C: TANGGAL LAHIR, D: NAMA JABATAN, E: ENTITAS, F: UNIT KERJA, 
          // G: KATEGORI, H: JENIS KELAMIN, I: PENDIDIKAN, J: (organik_non_organik - but contains pendidikan data in image),
          // K: PUSAT PELAYANAN (contains "ORGANIK" - this is the actual organik/non organik status),
          // L: NON OPERASIONAL, M: STATUS LAPORAN
          // 
          // ACTUAL CORRECT MAPPING (based on image analysis):
          // H (row[7]): JENIS KELAMIN (L/P)
          // I (row[8]): PENDIDIKAN (S1, S2, D3, L)
          // J (row[9]): Contains pendidikan data (WRONG - should be organik/non organik but has pendidikan)
          // K (row[10]): PUSAT PELAYANAN contains "ORGANIK" - this is actually the organik/non organik status
          // L (row[11]): NON OPERASIONAL (NON OPERASIONAL)
          // M (row[12]): STATUS LAPORAN
          //
          // From image: kategori = "ORGANIK PELINDO (PTP)" indicates all are organik
          // pusat_pelayanan (row[10]) = "ORGANIK" - this is the actual organik/non organik status
          
          // Parse tanggal lahir with comprehensive validation
          const tanggalLahirRaw = row[2];
          const tanggalLahirParsed = parseTanggalLahir(tanggalLahirRaw);
          
          // Determine organik/non organik - PRIORITIZE column J (row[9]) which should contain organik_non_organik directly
          // Column mapping: J (row[9]) = ORGANIK/NON ORGANIK
          const organikNonOrganikRaw = (row[9] || '').toString().trim(); // Column J
          const kategoriStr = (row[6] || '').toString().trim().toUpperCase();
          const pusatPelayananStr = (row[10] || '').toString().trim().toUpperCase(); // row[10] is column K
          let organikStatus = '';
          
          // PRIORITY 1: Check column J (row[9]) first - this is the direct organik_non_organik column
          if (organikNonOrganikRaw && organikNonOrganikRaw !== '') {
            const organikUpper = organikNonOrganikRaw.toUpperCase();
            if (organikUpper === 'ORGANIK' || organikUpper.includes('ORGANIK') && !organikUpper.includes('NON')) {
              organikStatus = 'ORGANIK';
            } else if (organikUpper.includes('NON') && organikUpper.includes('ORGANIK')) {
              organikStatus = 'NON ORGANIK';
            } else if (organikUpper === 'NON ORGANIK' || organikUpper === 'NON-ORGANIK') {
              organikStatus = 'NON ORGANIK';
            } else {
              // If value exists but unclear, use it as is
              organikStatus = organikNonOrganikRaw;
            }
          }
          // PRIORITY 2: Check pusat_pelayanan (column K) if column J is empty
          else if (pusatPelayananStr && pusatPelayananStr !== '') {
            if (pusatPelayananStr === 'ORGANIK' || (pusatPelayananStr.includes('ORGANIK') && !pusatPelayananStr.includes('NON'))) {
              organikStatus = 'ORGANIK';
            } else if (pusatPelayananStr.includes('NON') && pusatPelayananStr.includes('ORGANIK')) {
              organikStatus = 'NON ORGANIK';
            }
          }
          // PRIORITY 3: Fallback to kategori if both above are empty
          else if (kategoriStr && kategoriStr !== '') {
            if (kategoriStr.includes('ORGANIK') && !kategoriStr.includes('NON')) {
              organikStatus = 'ORGANIK';
            } else if (kategoriStr.includes('NON') && kategoriStr.includes('ORGANIK')) {
              organikStatus = 'NON ORGANIK';
            } else if (kategoriStr.includes('ORGANIK PELINDO')) {
              organikStatus = 'ORGANIK';
            }
          }
          
          rowData = {
            npp: (row[0] || '').toString().trim(),           // A
            nama: (row[1] || '').toString().trim(),          // B
            tanggal_lahir: tanggalLahirParsed || '',         // C
            jabatan: (row[3] || '').toString().trim(),       // D
            entitas: (row[4] || '').toString().trim(),       // E
            unit_kerja: (row[5] || '').toString().trim(),    // F
            kategori: (row[6] || '').toString().trim(),      // G
            jenis_kelamin: (row[7] || '').toString().trim(), // H (Jenis Kelamin: L/P)
            pendidikan: (row[8] || '').toString().trim(),      // I (Pendidikan: S1, S2, D3, L) - CORRECTED!
            organik_non_organik: organikStatus || '',         // NOW PRIORITIZES column J (row[9]) first!
            pusat_pelayanan: (row[10] || '').toString().trim(),   // K (Pusat Pelayanan - contains "ORGANIK" in image) - CORRECTED!
            non_operasional: (row[11] || '').toString().trim(),   // L (Non Operasional) - CORRECTED!
            status_laporan: (row[12] || '').toString().trim()     // M (Status Laporan) - CORRECTED!
          };

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
            INSERT INTO ptpdata (
              npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
              kategori, jenis_kelamin, pendidikan, organik_non_organik,
              pusat_pelayanan, non_operasional, status_laporan, bulan, tahun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            rowData.npp, rowData.nama, rowData.tanggal_lahir, rowData.jabatan,
            rowData.entitas, rowData.unit_kerja,
            rowData.kategori, rowData.jenis_kelamin, rowData.pendidikan, rowData.organik_non_organik,
            rowData.pusat_pelayanan, rowData.non_operasional, rowData.status_laporan,
            monthNum, yearNum
          ]);

          inserted++;
        } catch (error) {
          console.error(`Error inserting PTP row ${excelRowNumber}:`, error);
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

      let message = `PTP data uploaded successfully for ${monthNum}/${yearNum}. ${inserted} records inserted.`;
      if (deletedRows > 0) {
        message = `Replaced ${deletedRows} existing PTP records. ${inserted} new records inserted.`;
      }

      return NextResponse.json({
        success: true,
        message,
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
    console.error('PTP Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process PTP file',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
