import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';
import { generateOTP } from '@/lib/generateOTP';
import { sendOTP } from '@/lib/sendOTP';

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_SECRET_KEY?.trim();

  if (!secretKey) {
    console.warn('CLOUDFLARE_SECRET_KEY tidak ditemukan, skip verifikasi');
    return true;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      }
    );

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error verifying Turnstile:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, turnstileToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    // ================= CAPTCHA =================
    const secretKey = process.env.CLOUDFLARE_SECRET_KEY?.trim();

    if (secretKey) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Verifikasi CAPTCHA diperlukan' },
          { status: 400 }
        );
      }

      const isValid = await verifyTurnstileToken(turnstileToken);
      if (!isValid) {
        return NextResponse.json(
          { error: 'CAPTCHA gagal' },
          { status: 400 }
        );
      }
    }

    const connection = await mysql.createConnection(dbConfig);

    try {
      // ================= CEK USER =================
      const [rows]: any = await connection.execute(
        'SELECT * FROM user WHERE email = ?',
        [email]
      );

      if (!rows || rows.length === 0) {
        await connection.end();
        return NextResponse.json(
          { error: 'Email atau password salah' },
          { status: 401 }
        );
      }

      const user = rows[0];

      if (!user.is_active) {
        await connection.end();
        return NextResponse.json(
          { error: 'Akun dinonaktifkan' },
          { status: 403 }
        );
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password
      );

      if (!isValidPassword) {
        await connection.end();
        return NextResponse.json(
          { error: 'Email atau password salah' },
          { status: 401 }
        );
      }

      // ================= OTP =================
      const otp = generateOTP();
      const otpExpired = new Date(Date.now() + 5 * 60 * 1000);

      // simpan ke DB
      await connection.execute(
        'UPDATE user SET otp = ?, otp_expired = ? WHERE id = ?',
        [otp, otpExpired, user.id]
      );

      // DEBUG (WAJIB)
      console.log("Kirim OTP ke:", user.email);
      console.log("OTP:", otp);

      // kirim email
      try {
        await sendOTP(user.email, otp);
        console.log("Email OTP berhasil dikirim");
      } catch (error) {
        console.error("ERROR EMAIL:", error);
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        requireOTP: true,
        message: 'OTP dikirim ke email',
        email: user.email,
      });

    } catch (dbError) {
      await connection.end();
      console.error('DB error:', dbError);
      throw new Error('Gagal login');
    }

  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal login',
      },
      { status: 500 }
    );
  }
}