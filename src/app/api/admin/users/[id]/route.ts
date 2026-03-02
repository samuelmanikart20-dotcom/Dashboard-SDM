import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const url = new URL(request.url);
    const searchId = url.searchParams.get('id') || undefined;

    // Await params per Next.js requirement for dynamic API routes
    const awaitedParams = await params;
    const id = awaitedParams?.id ?? searchId;

    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    try {
      const [result] = await connection.execute(
        'DELETE FROM user WHERE id = ? LIMIT 1',
        [id]
      );

      const affected = (result as any).affectedRows || 0;
      await connection.end();

      if (affected === 0) {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
    } catch (dbError) {
      await connection.end();
      console.error('Database error (delete user):', dbError);
      return NextResponse.json({ error: 'Gagal menghapus user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghapus user' },
      { status: 500 }
    );
  }
}