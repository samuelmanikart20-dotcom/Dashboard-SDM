import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');

    connection = await mysql.createConnection(dbConfig);

    // Build WHERE clause for period filtering
    let whereClause = '';
    const params: any[] = [];
    
    if (bulan && tahun && bulan !== 'all') {
      const bulanInt = parseInt(bulan);
      const tahunInt = parseInt(tahun);
      
      if (!isNaN(bulanInt) && bulanInt >= 1 && bulanInt <= 12 && !isNaN(tahunInt) && tahunInt >= 2000 && tahunInt <= 2100) {
        whereClause = 'WHERE bulan = ? AND tahun = ?';
        params.push(bulanInt, tahunInt);
      } else {
        whereClause = 'WHERE 1=0'; // Invalid period, return no results
      }
    } else if (tahun) {
      const tahunInt = parseInt(tahun);
      if (!isNaN(tahunInt) && tahunInt >= 2000 && tahunInt <= 2100) {
        whereClause = 'WHERE tahun = ?';
        params.push(tahunInt);
      } else {
        whereClause = 'WHERE 1=0'; // Invalid year, return no results
      }
    } else {
      // No period specified, use all data (backward compatibility)
      whereClause = 'WHERE bulan IS NOT NULL AND tahun IS NOT NULL';
    }

    console.log('SDM Operasional Stats - Filtering with:', { bulan, tahun, whereClause, params });

    // Get SPMT stats - using same logic as TCU (prioritize non_operasional)
    const [spmtData] = await connection.execute(
      `SELECT 
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
      FROM spmtdata 
      ${whereClause}
      GROUP BY pusat_pelayanan, non_operasional`,
      params
    );
    
    let spmtOperasional = 0;
    let spmtNonOperasional = 0;
    (spmtData as any[]).forEach((row: any) => {
      let status = '';
      
      // SPMT logic: PRIORITIZE non_operasional column - it's the explicit status
      const nonOp = String(row.non_operasional || '').trim();
      const nonOpUpper = nonOp.toUpperCase();
      
      // Check non_operasional first - this is the PRIMARY source of truth
      // IMPORTANT: non_operasional column is the explicit status indicator
      if (nonOp && nonOp !== '') {
        // Exact matches first (case-insensitive)
        if (nonOpUpper === 'OPERASIONAL') {
          status = 'operasional';
        } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
          status = 'non-operasional';
        } 
        // Pattern matches - prioritize "NON" detection
        // If it contains "NON" anywhere, it's likely non-operasional
        else if (nonOpUpper.includes('NON')) {
          // Check if it's explicitly "NON OPERASIONAL" or similar
          if (nonOpUpper.includes('OPERASIONAL') || nonOpUpper.includes('OPERASI')) {
            status = 'non-operasional';
          } else {
            // Just "NON" without operasional/operasi, still non-operasional
            status = 'non-operasional';
          }
        } 
        // If it contains "OPERASIONAL" but NOT "NON", it's operasional
        else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
          status = 'operasional';
        }
      }
      
      // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
      // This is a fallback, not a primary source
      if (!status && row.pusat_pelayanan) {
        const pusatPelayanan = String(row.pusat_pelayanan).trim();
        const pusatPelayananUpper = pusatPelayanan.toUpperCase();
        
        if (pusatPelayananUpper.includes('OPERASI LANGSUNG') || pusatPelayananUpper.includes('OPERASI TIDAK LANGSUNG')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('PENGELOLAAN') || pusatPelayananUpper.includes('PENDUKUNG OPERASI')) {
          status = 'non-operasional';
        } else if (pusatPelayananUpper.includes('OPERASIONAL') && !pusatPelayananUpper.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('NON OPERASIONAL') || pusatPelayananUpper.includes('NON-OPERASIONAL')) {
          status = 'non-operasional';
        }
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      if (status === 'operasional') {
        spmtOperasional += row.count;
      } else {
        spmtNonOperasional += row.count;
      }
    });

    // Get PTP stats - using same logic as TCU (prioritize non_operasional)
    const [ptpData] = await connection.execute(
      `SELECT 
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
      FROM ptpdata 
      ${whereClause}
      GROUP BY pusat_pelayanan, non_operasional`,
      params
    );
    
    // Debug: log PTP data sample
    console.log('PTP Sample Data:', JSON.stringify((ptpData as any[]).slice(0, 10), null, 2));
    
    let ptpOperasional = 0;
    let ptpNonOperasional = 0;
    (ptpData as any[]).forEach((row: any) => {
      let status = '';
      
      // PTP logic: PRIORITIZE non_operasional column - it's the explicit status
      // This column explicitly states whether it's "Operasional" or "Non Operasional"
      const nonOp = String(row.non_operasional || '').trim();
      const nonOpUpper = nonOp.toUpperCase();
      
      // Check non_operasional first - this is the PRIMARY source of truth
      // IMPORTANT: non_operasional column is the explicit status indicator
      if (nonOp && nonOp !== '') {
        // Exact matches first (case-insensitive)
        if (nonOpUpper === 'OPERASIONAL') {
          status = 'operasional';
        } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
          status = 'non-operasional';
        } 
        // Pattern matches - prioritize "NON" detection
        // If it contains "NON" anywhere, it's likely non-operasional
        else if (nonOpUpper.includes('NON')) {
          // Check if it's explicitly "NON OPERASIONAL" or similar
          if (nonOpUpper.includes('OPERASIONAL') || nonOpUpper.includes('OPERASI')) {
            status = 'non-operasional';
          } else {
            // Just "NON" without operasional/operasi, still non-operasional
            status = 'non-operasional';
          }
        } 
        // If it contains "OPERASIONAL" but NOT "NON", it's operasional
        else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
          status = 'operasional';
        }
      }
      
      // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
      // This is a fallback, not a primary source
      if (!status && row.pusat_pelayanan) {
        const pusatPelayanan = String(row.pusat_pelayanan).trim();
        const pusatPelayananUpper = pusatPelayanan.toUpperCase();
        
        if (pusatPelayananUpper.includes('OPERASI LANGSUNG')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('PENDUKUNG OPERASI')) {
          status = 'non-operasional';
        } else if (pusatPelayananUpper.includes('OPERASIONAL') && !pusatPelayananUpper.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('NON OPERASIONAL') || pusatPelayananUpper.includes('NON-OPERASIONAL')) {
          status = 'non-operasional';
        } else if (pusatPelayananUpper.includes('OPERASI') && !pusatPelayananUpper.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('PENGELOLAAN')) {
          status = 'non-operasional';
        }
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      console.log(`PTP Row: pusat_pelayanan="${row.pusat_pelayanan}", non_operasional="${row.non_operasional}", count=${row.count}, status=${status}`);
      
      if (status === 'operasional') {
        ptpOperasional += row.count;
      } else {
        ptpNonOperasional += row.count;
      }
    });
    
    console.log(`PTP Final: Operasional=${ptpOperasional}, NonOperasional=${ptpNonOperasional}, Total=${ptpOperasional + ptpNonOperasional}`);

    // Get IKT stats - using same logic as TCU (prioritize non_operasional)
    const [iktData] = await connection.execute(
      `SELECT 
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
      FROM iktdata 
      ${whereClause}
      GROUP BY pusat_pelayanan, non_operasional`,
      params
    );
    
    let iktOperasional = 0;
    let iktNonOperasional = 0;
    (iktData as any[]).forEach((row: any) => {
      let status = '';
      
      // IKT logic: PRIORITIZE non_operasional column - it's the explicit status
      const nonOp = String(row.non_operasional || '').trim();
      const nonOpUpper = nonOp.toUpperCase();
      
      // Check non_operasional first - this is the PRIMARY source of truth
      // IMPORTANT: non_operasional column is the explicit status indicator
      if (nonOp && nonOp !== '') {
        // Exact matches first (case-insensitive)
        if (nonOpUpper === 'OPERASIONAL') {
          status = 'operasional';
        } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
          status = 'non-operasional';
        } 
        // Pattern matches - prioritize "NON" detection
        // If it contains "NON" anywhere, it's likely non-operasional
        else if (nonOpUpper.includes('NON')) {
          // Check if it's explicitly "NON OPERASIONAL" or similar
          if (nonOpUpper.includes('OPERASIONAL') || nonOpUpper.includes('OPERASI')) {
            status = 'non-operasional';
          } else {
            // Just "NON" without operasional/operasi, still non-operasional
            status = 'non-operasional';
          }
        } 
        // If it contains "OPERASIONAL" but NOT "NON", it's operasional
        else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
          status = 'operasional';
        }
      }
      
      // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
      // This is a fallback, not a primary source
      if (!status && row.pusat_pelayanan) {
        const pusatPelayanan = String(row.pusat_pelayanan).trim();
        const pusatPelayananUpper = pusatPelayanan.toUpperCase();
        
        if (pusatPelayananUpper.includes('OPERASI LANGSUNG')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('PENDUKUNG OPERASI')) {
          status = 'non-operasional';
        } else if (pusatPelayananUpper.includes('OPERASIONAL') && !pusatPelayananUpper.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('NON OPERASIONAL') || pusatPelayananUpper.includes('NON-OPERASIONAL')) {
          status = 'non-operasional';
        }
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      if (status === 'operasional') {
        iktOperasional += row.count;
      } else {
        iktNonOperasional += row.count;
      }
    });

    // Get TCU stats - using same logic as tcu-dashboard-stats
    // TCU uses non_operasional column first (exact match), then pusat_pelayanan as fallback
    const [tcuData] = await connection.execute(
      `SELECT 
        pusat_pelayanan,
        non_operasional,
        COUNT(*) as count
      FROM tcudata 
      ${whereClause}
      GROUP BY pusat_pelayanan, non_operasional`,
      params
    );
    
    let tcuOperasional = 0;
    let tcuNonOperasional = 0;
    (tcuData as any[]).forEach((row: any) => {
      let status = '';
      
      // TCU logic: PRIORITIZE non_operasional column - it's the explicit status
      // This column explicitly states whether it's "Operasional" or "Non Operasional"
      const nonOp = String(row.non_operasional || '').trim();
      const nonOpUpper = nonOp.toUpperCase();
      
      // Check non_operasional first - this is the PRIMARY source of truth
      // If non_operasional has a value, it takes precedence over pusat_pelayanan
      // IMPORTANT: non_operasional column is the explicit status indicator
      if (nonOp && nonOp !== '') {
        // Exact matches first (case-insensitive)
        if (nonOpUpper === 'OPERASIONAL') {
          status = 'operasional';
        } else if (nonOpUpper === 'NON OPERASIONAL' || nonOpUpper === 'NON-OPERASIONAL') {
          status = 'non-operasional';
        } 
        // Pattern matches - prioritize "NON" detection
        // If it contains "NON" anywhere, it's likely non-operasional
        else if (nonOpUpper.includes('NON')) {
          // Check if it's explicitly "NON OPERASIONAL" or similar
          if (nonOpUpper.includes('OPERASIONAL') || nonOpUpper.includes('OPERASI')) {
            status = 'non-operasional';
          } else {
            // Just "NON" without operasional/operasi, still non-operasional
            status = 'non-operasional';
          }
        } 
        // If it contains "OPERASIONAL" but NOT "NON", it's operasional
        else if (nonOpUpper.includes('OPERASIONAL') && !nonOpUpper.includes('NON')) {
          status = 'operasional';
        }
      }
      
      // ONLY if non_operasional is empty, null, or unclear, then check pusat_pelayanan
      // This is a fallback, not a primary source
      if (!status && row.pusat_pelayanan) {
        const pusatPelayanan = String(row.pusat_pelayanan).trim();
        const pusatPelayananUpper = pusatPelayanan.toUpperCase();
        
        if (pusatPelayananUpper.includes('OPERASI LANGSUNG')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('PENDUKUNG OPERASI')) {
          status = 'non-operasional';
        } else if (pusatPelayananUpper.includes('OPERASIONAL') && !pusatPelayananUpper.includes('NON')) {
          status = 'operasional';
        } else if (pusatPelayananUpper.includes('NON OPERASIONAL') || pusatPelayananUpper.includes('NON-OPERASIONAL')) {
          status = 'non-operasional';
        }
      }
      
      // Default fallback
      if (!status) {
        status = 'non-operasional';
      }
      
      console.log(`TCU Row: pusat_pelayanan="${row.pusat_pelayanan}", non_operasional="${row.non_operasional}", count=${row.count}, status=${status}`);
      
      if (status === 'operasional') {
        tcuOperasional += row.count;
      } else {
        tcuNonOperasional += row.count;
      }
    });
    
    console.log(`TCU Final: Operasional=${tcuOperasional}, NonOperasional=${tcuNonOperasional}, Total=${tcuOperasional + tcuNonOperasional}`);

    return NextResponse.json({
      success: true,
      data: {
        spmt: {
          operasional: spmtOperasional,
          nonOperasional: spmtNonOperasional,
          total: spmtOperasional + spmtNonOperasional,
        },
        ptp: {
          operasional: ptpOperasional,
          nonOperasional: ptpNonOperasional,
          total: ptpOperasional + ptpNonOperasional,
        },
        ikt: {
          operasional: iktOperasional,
          nonOperasional: iktNonOperasional,
          total: iktOperasional + iktNonOperasional,
        },
        tcu: {
          operasional: tcuOperasional,
          nonOperasional: tcuNonOperasional,
          total: tcuOperasional + tcuNonOperasional,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching SDM operasional stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching SDM operasional stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

