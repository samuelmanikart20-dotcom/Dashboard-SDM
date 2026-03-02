import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const { id } = awaitedParams;
    const { isActive } = await request.json();

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Status aktif harus boolean' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // Update user status
      await connection.execute(
        'UPDATE user SET is_active = ? WHERE id = ?',
        [isActive, id]
      );

      // Check if user was updated
      const [rows] = await connection.execute(
        'SELECT id FROM user WHERE id = ?',
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        message: `User berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      throw new Error('Gagal mengupdate status user');
    }

  } catch (error) {
    console.error('Toggle user status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mengupdate status user' },
      { status: 500 }
    );
  }
}

