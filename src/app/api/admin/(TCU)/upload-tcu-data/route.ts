import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import * as XLSX from "xlsx";

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spmt_pelindo_revisi",
  port: Number(process.env.DB_PORT) || 3307,
};

function normalizeGender(gender: string): string {
  const g = gender.toUpperCase().trim();
  if (g === "L" || g.includes("LAKI")) {
    return "Laki-laki";
  } else if (g === "P" || g.includes("PEREMPUAN")) {
    return "Perempuan";
  }
  return gender; // Return original if no match
}

function normalizeOrganikStatus(status: string): string {
  if (!status || status.trim() === '') {
    return status;
  }
  const s = status.toUpperCase().trim();
  
  // Check for Non Organik first (more specific)
  if (
    s.includes("NON ORGANIK") ||
    s.includes("NON-ORGANIK") ||
    s.includes("NONORGANIK") ||
    s.includes("PKWT") ||
    (s.includes("NON") && s.includes("ORGANIK"))
  ) {
    return "Non Organik";
  }
  
  // Check for Organik (must contain ORGANIK and NOT contain NON)
  if (s.includes("ORGANIK") && !s.includes("NON")) {
    return "Organik";
  }
  
  // Default: return original if no match
  return status;
}

function normalizeOperationalStatus(status: string): string {
  const s = status.toUpperCase().trim();
  if (s.includes("OPERASIONAL") && !s.includes("NON")) {
    return "Operasional";
  } else if (s.includes("NON") && s.includes("OPERASIONAL")) {
    return "Non Operasional";
  } else if (s.includes("NON") && s.includes("OPERASI")) {
    return "Non Operasional";
  }
  // Default fallback - if unclear, assume Operasional
  return "Operasional";
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bulan = parseInt(formData.get("bulan") as string);
    const tahun = parseInt(formData.get("tahun") as string);

    if (!file) {
      return NextResponse.json(
        { message: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!bulan || !tahun) {
      return NextResponse.json(
        { message: "Bulan dan tahun harus diisi" },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook;

    try {
      // Try to read as Excel file
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      // If Excel fails, try as CSV
      try {
        workbook = XLSX.read(buffer, { type: "buffer", raw: true });
      } catch {
        return NextResponse.json(
          {
            message:
              "File format tidak didukung. Gunakan Excel (.xlsx, .xls) atau CSV.",
          },
          { status: 400 }
        );
      }
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return NextResponse.json(
        { message: "File kosong atau tidak memiliki data" },
        { status: 400 }
      );
    }

    // Expected column mapping for TCU data (UPDATED to include PENDIDIKAN)
    // NPP, NAMA, TANGGAL LAHIR, NAMA JABATAN, ENTITAS, UNIT KERJA,
    // KATEGORI, JENIS KELAMIN, PENDIDIKAN, JENIS PEKERJA (ORGANIK/NON ORGANIK), PUSAT PELAYANAN,
    // OPERASIONAL/NON OPERASIONAL, STATUS LAPORAN RAKOMDIR

    const processedData = [] as any[];
    const errors = [] as Array<{
      row: number;
      column?: string;
      value?: string;
      reason: string;
    }>;

    // Skip header row, start from index 1
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      const excelRowNumber = i + 1; // Excel row number (accounting for header row)

      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) {
        if (row && row.some(cell => cell && cell.toString().trim())) {
          // Row has some data but is considered empty
          errors.push({
            row: excelRowNumber,
            reason: 'Baris tidak lengkap atau kosong',
            value: row.slice(0, 3).join(', ')
          });
        }
        continue;
      }

      try {
        // Parse tanggal lahir with comprehensive validation
        let tanggalLahir = null as string | null;
        if (row[2]) {
          const dateStr = row[2].toString().trim();

          // Skip if empty or contains obviously invalid patterns
          // Accept "-" as valid value for empty date (will be stored as null)
          if (!dateStr || dateStr === "" || dateStr === "NULL" || dateStr === "null" || dateStr === "-") {
            tanggalLahir = null;
          } else {
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
                    tanggalLahir = jsDate.toISOString().split("T")[0];
                  }
                }
              }
              
              // If not Excel serial, try parsing as date string
              if (!tanggalLahir) {
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
                    Jan: "01",
                    January: "01",
                    Feb: "02",
                    February: "02",
                    Mar: "03",
                    March: "03",
                    Apr: "04",
                    April: "04",
                    May: "05",
                    Jun: "06",
                    June: "06",
                    Jul: "07",
                    July: "07",
                    Aug: "08",
                    August: "08",
                    Sep: "09",
                    September: "09",
                    Oct: "10",
                    October: "10",
                    Nov: "11",
                    November: "11",
                    Dec: "12",
                    December: "12",
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
                    // Try DD/MM/YYYY first
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]);
                    const year = parseInt(parts[2]);
                    
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
                    } else if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                      const dayStr = parts[0].padStart(2, "0");
                      const monthStr = parts[1].padStart(2, "0");
                      tanggalLahir = `${year}-${monthStr}-${dayStr}`;
                    }
              }
                } else if (cleanDateStr.includes(" ")) {
              // Format: "2 09 1993" (space separated)
                  const parts = cleanDateStr.split(" ").filter((p: string) => p.trim());
              if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]);
                    const year = parseInt(parts[2]);
                    
                    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                      const dayStr = parts[0].padStart(2, "0");
                      const monthStr = parts[1].padStart(2, "0");
                      tanggalLahir = `${year}-${monthStr}-${dayStr}`;
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
          } catch {
            // If parsing fails, set to null
            tanggalLahir = null;
            }
          }
        }

        const processedRow = {
          npp: row[0]?.toString().trim() || "",
          nama: row[1]?.toString().trim() || "",
          tanggal_lahir: tanggalLahir,
          jabatan: row[3]?.toString().trim() || "",
          entitas: row[4]?.toString().trim() || "",
          unit_kerja: row[5]?.toString().trim() || "",
          kategori: row[6]?.toString().trim() || "",
          jenis_kelamin: normalizeGender(row[7]?.toString().trim() || ""),
          pendidikan: row[8]?.toString().trim() || "",
          organik_non_organik: normalizeOrganikStatus(
            row[9]?.toString().trim() || ""
          ),
          pusat_pelayanan: normalizeOperationalStatus(
            row[10]?.toString().trim() || ""
          ),
          non_operasional: normalizeOperationalStatus(
            row[11]?.toString().trim() || ""
          ),
          status_laporan: row[12]?.toString().trim() || "",
          bulan,
          tahun,
        };

        // Validate required fields
        if (!processedRow.npp || !processedRow.nama) {
          const missingFields = [];
          if (!processedRow.npp) missingFields.push('NPP');
          if (!processedRow.nama) missingFields.push('NAMA');
          
          errors.push({
            row: excelRowNumber,
            column: missingFields.join(', '),
            reason: `Kolom tidak boleh kosong: ${missingFields.join(', ')}`,
            value: `NPP: "${processedRow.npp || ''}", NAMA: "${processedRow.nama || ''}"`
          });
          continue;
        }
        
        // Validate tanggal_lahir if provided
        // Accept "-" as valid value for empty date
        const tanggalLahirRawStr = String(row[2] || '').trim();
        if (tanggalLahirRawStr && tanggalLahirRawStr !== "-" && !tanggalLahir) {
          errors.push({
            row: excelRowNumber,
            column: 'TANGGAL LAHIR',
            value: tanggalLahirRawStr,
            reason: 'Format tanggal lahir tidak valid atau tahun di luar rentang 1900-2100'
          });
          continue;
        }

        processedData.push(processedRow);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Try to identify which column caused the error
        let problematicColumn = 'Tidak diketahui';
        let problematicValue = '';
        
        if (errorMessage.includes('npp') || errorMessage.includes('NPP')) {
          problematicColumn = 'NPP';
          problematicValue = row[0]?.toString() || '';
        } else if (errorMessage.includes('nama') || errorMessage.includes('NAMA')) {
          problematicColumn = 'NAMA';
          problematicValue = row[1]?.toString() || '';
        } else if (errorMessage.includes('tanggal') || errorMessage.includes('date')) {
          problematicColumn = 'TANGGAL LAHIR';
          problematicValue = row[2]?.toString() || '';
        }
        
        errors.push({
          row: excelRowNumber,
          column: problematicColumn,
          value: problematicValue || 'N/A',
          reason: errorMessage
        });
      }
    }

    if (processedData.length === 0) {
      return NextResponse.json(
        {
          message: "Tidak ada data valid yang dapat diproses",
          errors,
        },
        { status: 400 }
      );
    }

    // Connect to database
    connection = await mysql.createConnection(dbConfig);

    // Ensure tcudata table exists and has pendidikan column
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tcudata (
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
        INDEX idx_bulan_tahun (bulan, tahun),
        INDEX idx_unit_kerja (unit_kerja),
        INDEX idx_entitas (entitas),
        INDEX idx_pendidikan (pendidikan)
      )
    `);

    const [colRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tcudata' AND COLUMN_NAME = 'pendidikan'`
    );
    const hasPendidikan = (colRows as any)[0]?.cnt > 0;
    if (!hasPendidikan) {
      await connection.execute(`
        ALTER TABLE tcudata
        ADD COLUMN pendidikan VARCHAR(50) NULL AFTER jenis_kelamin
      `);
    }

    // Start transaction
    await connection.beginTransaction();

    try {
      // Delete existing data for the same month/year (data replacement)
      const deleteResult = await connection.execute(
        "DELETE FROM tcudata WHERE bulan = ? AND tahun = ?",
        [bulan, tahun]
      );

      // Insert new data
      const insertQuery = `
        INSERT INTO tcudata (
          npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja, 
          kategori, jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan, 
          non_operasional, status_laporan, bulan, tahun
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      let insertedCount = 0;
      const insertErrors = [] as Array<{
        row: number;
        column?: string;
        value?: string;
        reason: string;
      }>;
      
      for (let idx = 0; idx < processedData.length; idx++) {
        const row = processedData[idx];
        try {
        await connection.execute(insertQuery, [
          row.npp,
          row.nama,
          row.tanggal_lahir,
          row.jabatan,
          row.entitas,
          row.unit_kerja,
          row.kategori,
          row.jenis_kelamin,
          row.pendidikan,
          row.organik_non_organik,
          row.pusat_pelayanan,
          row.non_operasional,
          row.status_laporan,
          row.bulan,
          row.tahun,
        ]);
        insertedCount++;
        } catch (insertError) {
          const errorMessage = insertError instanceof Error ? insertError.message : String(insertError);
          
          // Try to identify which column caused the error
          let problematicColumn = 'Tidak diketahui';
          let problematicValue = '';
          
          if (errorMessage.includes('npp') || errorMessage.includes('NPP') || errorMessage.includes('duplicate') || errorMessage.includes('Duplicate')) {
            problematicColumn = 'NPP';
            problematicValue = row.npp || '';
          } else if (errorMessage.includes('nama') || errorMessage.includes('NAMA')) {
            problematicColumn = 'NAMA';
            problematicValue = row.nama || '';
          }
          
          insertErrors.push({
            row: idx + 2, // Approximate row number (we don't have exact Excel row number here)
            column: problematicColumn,
            value: problematicValue || 'N/A',
            reason: errorMessage.includes('Duplicate') 
              ? 'Data duplikat (NPP sudah ada di database)'
              : errorMessage
          });
        }
      }
      
      // Combine processing errors with insert errors
      const allErrors = [...errors, ...insertErrors];

      // Commit transaction
      await connection.commit();

      const deletedCount = (deleteResult[0] as any).affectedRows;
      let message = `${insertedCount} data TCU berhasil diupload.`;
      if (deletedCount > 0) {
        message = `Replaced ${deletedCount} existing records. ${insertedCount} new TCU records inserted.`;
      }

      return NextResponse.json({
        success: true,
        message,
        totalRecords: processedData.length + allErrors.length,
        inserted: insertedCount,
        updated: deletedCount,
        errors: allErrors.length,
        insertedCount,
        deletedCount,
        errorDetails: allErrors.length > 0 ? allErrors : undefined,
      });
    } catch (dbError) {
      // Rollback transaction on error
      await connection.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        message: "Terjadi kesalahan saat mengupload data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
