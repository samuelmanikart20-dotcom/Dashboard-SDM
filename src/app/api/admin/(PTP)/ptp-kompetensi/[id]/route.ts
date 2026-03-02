'use server';

import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spmt_pelindo',
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { jenis, isi } = body || {};
    if (!jenis && !isi) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (jenis) { fields.push('jenis = ?'); values.push(jenis); }
    if (isi !== undefined) { fields.push('isi = ?'); values.push(isi); }
    values.push(id);

    const conn = await getConnection();
    try {
      await conn.execute(`UPDATE ptp_kompetensi SET ${fields.join(', ')} WHERE id = ?`, values);
      return NextResponse.json({ message: 'Updated' });
    } finally {
      await conn.end();
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to update', error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conn = await getConnection();
    try {
      await conn.execute('DELETE FROM ptp_kompetensi WHERE id = ?', [id]);
      return NextResponse.json({ message: 'Deleted' });
    } finally {
      await conn.end();
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to delete', error: errorMessage }, { status: 500 });
  }
}
