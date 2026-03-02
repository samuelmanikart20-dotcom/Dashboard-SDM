import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { dbConfig } from '@/lib/db-config';

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_SECRET_KEY?.trim();
  
  if (!secretKey) {
    console.warn('CLOUDFLARE_SECRET_KEY tidak ditemukan, skip verifikasi Turnstile');
    return true; // Allow login if secret key not configured (for development)
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, turnstileToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password diperlukan' }, { status: 400 });
    }

    // Verify Turnstile token (skip if CLOUDFLARE_SECRET_KEY is not configured)
    const secretKey = process.env.CLOUDFLARE_SECRET_KEY?.trim();
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] CLOUDFLARE_SECRET_KEY check:', {
        exists: !!secretKey,
        length: secretKey?.length || 0,
        firstChars: secretKey ? `${secretKey.substring(0, 4)}...` : 'N/A'
      });
    }
    
    if (secretKey) {
      // Only verify if secret key is configured
      if (!turnstileToken) {
        return NextResponse.json({ 
          error: 'Verifikasi CAPTCHA diperlukan' 
        }, { status: 400 });
      }
      
      const isValidToken = await verifyTurnstileToken(turnstileToken);
      if (!isValidToken) {
        return NextResponse.json({ 
          error: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' 
        }, { status: 400 });
      }
    } else {
      // Skip verification if secret key is not configured
      console.warn('CLOUDFLARE_SECRET_KEY tidak ditemukan, skip verifikasi Turnstile');
      console.warn('Pastikan CLOUDFLARE_SECRET_KEY ada di .env.local dengan format: CLOUDFLARE_SECRET_KEY=your_secret_key');
    }

    const connection = await mysql.createConnection(dbConfig);
    
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('superadmin', 'admin', 'admin_pembelajaran', 'user') DEFAULT 'user',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_login TIMESTAMP NULL,
          INDEX idx_email (email),
          INDEX idx_role (role),
          INDEX idx_is_active (is_active)
        )
      `);

      // Check if user exists and is active
      const [rows] = await connection.execute(
        'SELECT id, name, email, password, role, is_active FROM user WHERE email = ?',
        [email]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      }

      const user = rows[0] as any;

      // Check if user is active
      if (!user.is_active) {
        await connection.end();
        return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.' }, { status: 403 });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        await connection.end();
        return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      }

      // Update last login
      await connection.execute(
        'UPDATE user SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      await connection.end();

      // Return user data (without password)
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      return NextResponse.json({
        success: true,
        message: 'Login berhasil',
        user: userData
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      throw new Error('Gagal melakukan login');
    }

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal melakukan login' },
      { status: 500 }
    );
  }
}


