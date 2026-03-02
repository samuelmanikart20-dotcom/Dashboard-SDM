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
    const { id: rawId } = await params;
    if (!rawId) {
      return NextResponse.json({ message: 'Missing route param id' }, { status: 400 });
    }
    const idNum = Number(rawId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json();
    const { jenis, isi } = body || {};
    if (!jenis && isi === undefined) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }
    const fields: string[] = [];
    const values: any[] = [];
    if (jenis) { fields.push('jenis = ?'); values.push(jenis); }
    if (isi !== undefined) { fields.push('isi = ?'); values.push(isi); }

    if (fields.length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    values.push(idNum);

    const conn = await getConnection();
    try {
      await conn.execute(`UPDATE spmt_kompetensi SET ${fields.join(', ')} WHERE id = ?`, values);
      return NextResponse.json({ message: 'Updated' });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return NextResponse.json({ message: 'Failed to update', error: e?.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    if (!rawId) {
      return NextResponse.json({ message: 'Missing route param id' }, { status: 400 });
    }
    const idNum = Number(rawId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }
    const conn = await getConnection();
    try {
      await conn.execute('DELETE FROM spmt_kompetensi WHERE id = ?', [idNum]);
      return NextResponse.json({ message: 'Deleted' });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return NextResponse.json({ message: 'Failed to delete', error: e?.message }, { status: 500 });
  }
}
