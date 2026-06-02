import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
};

// POST /api/auth/verify-otp
export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Email dan OTP wajib diisi' }, { status: 400 });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows]: any = await conn.execute(
      'SELECT id, otp, otp_expired FROM user WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    await conn.end();

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Email tidak ditemukan' }, { status: 404 });
    }

    const user = (rows as any[])[0];

    // Cek OTP cocok
    if (String(user.otp) !== String(otp)) {
      return NextResponse.json({ success: false, error: 'Kode OTP tidak valid' }, { status: 400 });
    }

    // Cek expired
    const now = new Date();
    const expired = new Date(user.otp_expired);
    if (now > expired) {
      return NextResponse.json({ success: false, error: 'Kode OTP sudah kadaluarsa. Minta kode baru.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'OTP valid' });
  } catch (err) {
    console.error('verify-otp error:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}