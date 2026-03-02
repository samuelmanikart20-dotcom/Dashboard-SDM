import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';


// GET - Fetch all BOPO SPMT data or filter by daerah_id, bulan, tahun
export async function GET(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const { searchParams } = new URL(request.url);
    const daerahId = searchParams.get('daerah_id');
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    
    let query = `
      SELECT 
        b.id,
        b.daerah_id,
        d.nama as daerah_nama,
        d.kode as daerah_kode,
        b.bopo_ratio,
        b.produktivitas_efisiensi,
        b.rasio_beban_penghasilan_usaha,
        b.bulan,
        b.tahun,
        b.keterangan,
        b.created_at,
        b.updated_at
      FROM bopo_spmt b
      JOIN daerah d ON b.daerah_id = d.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (daerahId) {
      query += ' AND b.daerah_id = ?';
      params.push(daerahId);
    }
    
    if (bulan) {
      query += ' AND b.bulan = ?';
      params.push(bulan);
    }
    
    if (tahun) {
      query += ' AND b.tahun = ?';
      params.push(tahun);
    }
    
    query += ' ORDER BY b.tahun DESC, b.bulan DESC, d.nama ASC';
    
    const [rows] = await connection.execute(query, params);
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching BOPO SPMT data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch BOPO SPMT data' },
      { status: 500 }
    );
  }
}

// POST - Create new BOPO SPMT data
export async function POST(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const body = await request.json();
    const {
      daerah_id,
      bopo_ratio,
      produktivitas_efisiensi,
      rasio_beban_penghasilan_usaha,
      bulan,
      tahun,
      keterangan
    } = body;
    
    // Validate required fields
    if (!daerah_id || !bulan || !tahun) {
      return NextResponse.json(
        { success: false, error: 'daerah_id, bulan, and tahun are required' },
        { status: 400 }
      );
    }
    
    // Check if record already exists for this daerah, bulan, and tahun
    const [existingRecords] = await connection.execute(
      'SELECT id FROM bopo_spmt WHERE daerah_id = ? AND bulan = ? AND tahun = ?',
      [daerah_id, bulan, tahun]
    );
    
    if (Array.isArray(existingRecords) && existingRecords.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Data already exists for this region and period' },
        { status: 409 }
      );
    }
    
    const query = `
      INSERT INTO bopo_spmt (
        daerah_id, bopo_ratio, produktivitas_efisiensi, rasio_beban_penghasilan_usaha,
        bulan, tahun, keterangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      daerah_id,
      bopo_ratio || null,
      produktivitas_efisiensi || null,
      rasio_beban_penghasilan_usaha || null,
      bulan,
      tahun,
      keterangan || null
    ];
    
    const [result] = await connection.execute(query, params);
    await connection.end();
    
    return NextResponse.json({
      success: true,
      message: 'BOPO SPMT data created successfully',
      data: { id: (result as any).insertId }
    });
  } catch (error) {
    console.error('Error creating BOPO SPMT data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create BOPO SPMT data' },
      { status: 500 }
    );
  }
}

// PUT - Update existing BOPO SPMT data
export async function PUT(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for update' },
        { status: 400 }
      );
    }
    
    // Check if record exists
    const [existingRecords] = await connection.execute(
      'SELECT id FROM bopo_spmt WHERE id = ?',
      [id]
    );
    
    if (Array.isArray(existingRecords) && existingRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }
    
    // Build dynamic update query
    const updateFields = [];
    const params = [];
    
    const fieldMappings = {
      daerah_id: 'daerah_id',
      bopo_ratio: 'bopo_ratio',
      produktivitas_efisiensi: 'produktivitas_efisiensi',
      rasio_beban_penghasilan_usaha: 'rasio_beban_penghasilan_usaha',
      bulan: 'bulan',
      tahun: 'tahun',
      keterangan: 'keterangan'
    };
    
    for (const [key, field] of Object.entries(fieldMappings)) {
      if (updateData[key] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(updateData[key]);
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }
    
    params.push(id);
    
    const query = `UPDATE bopo_spmt SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    await connection.execute(query, params);
    await connection.end();
    
    return NextResponse.json({
      success: true,
      message: 'BOPO SPMT data updated successfully'
    });
  } catch (error) {
    console.error('Error updating BOPO SPMT data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update BOPO SPMT data' },
      { status: 500 }
    );
  }
}

// DELETE - Delete BOPO SPMT data
export async function DELETE(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }
    
    // Check if record exists
    const [existingRecords] = await connection.execute(
      'SELECT id FROM bopo_spmt WHERE id = ?',
      [id]
    );
    
    if (Array.isArray(existingRecords) && existingRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }
    
    await connection.execute('DELETE FROM bopo_spmt WHERE id = ?', [id]);
    await connection.end();
    
    return NextResponse.json({
      success: true,
      message: 'BOPO SPMT data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting BOPO SPMT data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete BOPO SPMT data' },
      { status: 500 }
    );
  }
}
