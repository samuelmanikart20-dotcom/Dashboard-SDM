import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';
import { generateOTP } from '@/lib/generateOTP';
import { sendOTP } from '@/lib/sendOTP';

// ================= TURNSTILE VERIFY =================
async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_SECRET_KEY?.trim();

  // kalau tidak pakai captcha → skip
  if (!secretKey) {
    console.warn('⚠️ CLOUDFLARE_SECRET_KEY tidak ada → skip captcha');
    return true;
  }

  if (!token) {
    console.warn('⚠️ Token captcha kosong');
    return false;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
      }
    );

    const data = await response.json();

    // DEBUG WAJIB
    console.log('🔥 CF RESPONSE:', data);

    return data.success === true;
  } catch (error) {
    console.error('❌ Error verify Turnstile:', error);
    return false;
  }
}

// ================= LOGIN API =================
export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const { email, password, turnstileToken } = body;

    // ================= VALIDASI INPUT =================
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    // ================= CAPTCHA =================
    const isCaptchaValid = await verifyTurnstileToken(turnstileToken);

    if (!isCaptchaValid) {
      return NextResponse.json(
        { error: 'Verifikasi CAPTCHA gagal' },
        { status: 400 }
      );
    }

    // ================= CONNECT DB =================
    connection = await mysql.createConnection(dbConfig);

    // ================= CEK USER =================
    const [rows]: any = await connection.execute(
      'SELECT * FROM user WHERE email = ?',
      [email]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    const user = rows[0];

    // ================= STATUS USER =================
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Akun dinonaktifkan' },
        { status: 403 }
      );
    }

    // ================= VALIDASI PASSWORD =================
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // ================= GENERATE OTP =================
    const otp = generateOTP();
    const otpExpired = new Date(Date.now() + 5 * 60 * 1000);

    await connection.execute(
      'UPDATE user SET otp = ?, otp_expired = ? WHERE id = ?',
      [otp, otpExpired, user.id]
    );

    // DEBUG OTP
    console.log('📧 Kirim OTP ke:', user.email);
    console.log('🔑 OTP:', otp);

    // ================= KIRIM EMAIL =================
    try {
      await sendOTP(user.email, otp);
      console.log('✅ Email OTP berhasil dikirim');
    } catch (error) {
      console.error('❌ ERROR EMAIL:', error);
    }

    return NextResponse.json({
      success: true,
      requireOTP: true,
      message: 'OTP dikirim ke email',
      email: user.email,
    });

  } catch (error) {
    console.error('❌ Login error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal login',
      },
      { status: 500 }
    );
  } finally {
    // ================= PASTIKAN CONNECTION DITUTUP =================
    if (connection) {
      await connection.end();
    }
  }
}