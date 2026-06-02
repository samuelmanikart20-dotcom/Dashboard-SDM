import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
};

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const { email, otp, password } = await request.json();

    if (!email || !otp || !password) {
      return NextResponse.json({ success: false, error: 'Semua field wajib diisi' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password minimal 8 karakter' }, { status: 400 });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows]: any = await conn.execute(
      'SELECT id, otp, otp_expired FROM user WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if ((rows as any[]).length === 0) {
      await conn.end();
      return NextResponse.json({ success: false, error: 'Email tidak ditemukan' }, { status: 404 });
    }

    const user = (rows as any[])[0];

    // Verifikasi OTP sekali lagi sebelum reset
    if (String(user.otp) !== String(otp)) {
      await conn.end();
      return NextResponse.json({ success: false, error: 'Kode OTP tidak valid' }, { status: 400 });
    }

    const now = new Date();
    const expired = new Date(user.otp_expired);
    if (now > expired) {
      await conn.end();
      return NextResponse.json({ success: false, error: 'Kode OTP sudah kadaluarsa' }, { status: 400 });
    }

    // Hash password baru
    const hashed = await bcrypt.hash(password, 10);

    // Update password & hapus OTP
    await conn.execute(
      'UPDATE user SET password = ?, otp = NULL, otp_expired = NULL, updated_at = NOW() WHERE email = ?',
      [hashed, email.toLowerCase().trim()]
    );

    await conn.end();

    return NextResponse.json({ success: true, message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}