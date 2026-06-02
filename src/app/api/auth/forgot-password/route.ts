import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
};

async function sendOTP(email: string, otp: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SPMT Pelindo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Kode Reset Password - SPMT Pelindo',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#1a56db;margin:0;">SPMT Pelindo</h2>
          <p style="color:#6b7280;margin:4px 0 0;">Reset Password</p>
        </div>
        <div style="background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 16px;">Hai,</p>
          <p style="color:#374151;margin:0 0 16px;">Kami menerima permintaan reset password untuk akun Anda. Gunakan kode OTP berikut:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1a56db;background:#eff6ff;padding:12px 24px;border-radius:8px;">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;margin:16px 0 0;text-align:center;">Kode berlaku selama <strong>5 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
      </div>
    `,
  });
}

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email wajib diisi' }, { status: 400 });
    }

    const conn = await mysql.createConnection(dbConfig);

    // Cek apakah email terdaftar
    const [rows]: any = await conn.execute(
      'SELECT id, email FROM user WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );

    if ((rows as any[]).length === 0) {
      await conn.end();
      // Tetap return success agar tidak bocorkan info email terdaftar/tidak
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, kode OTP akan dikirim.',
      });
    }

    // Generate OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan OTP ke kolom otp & otp_expired
    await conn.execute(
      'UPDATE user SET otp = ?, otp_expired = ? WHERE email = ?',
      [otp, expiredAt, email.toLowerCase().trim()]
    );

    await conn.end();

    // Kirim email
    await sendOTP(email, otp);

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah dikirim ke email Anda.',
    });
  } catch (err) {
    console.error('forgot-password error:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}