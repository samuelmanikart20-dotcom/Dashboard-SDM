import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

import { dbConfig } from '@/lib/db-config';
import { sendAccountEmail } from '@/lib/send-email';

export async function GET(_request: NextRequest) {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(`
      SELECT 
        id,
        name,
        email,
        role,
        is_active as isActive,
        created_at as createdAt,
        last_login as lastLogin
      FROM user
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      users: rows,
    });

  } catch (error) {
    console.error('Fetch users error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal mengambil data pengguna',
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    const { name, email, password, role } = await request.json();

    // VALIDASI FIELD
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Semua field harus diisi' },
        { status: 400 }
      );
    }

    // VALIDASI EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    // VALIDASI PASSWORD
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    // VALIDASI ROLE
    const validRoles = [
      'superadmin',
      'admin',
      'admin_pembelajaran',
      'user',
    ];

    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Role tidak valid' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // CEK EMAIL DUPLIKAT
    const [existingUsers] = await connection.execute(
      'SELECT id FROM user WHERE email = ?',
      [email]
    );

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT USER
    const [result] = await connection.execute(
      `
      INSERT INTO user
      (name, email, password, role, is_active)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        name,
        email,
        hashedPassword,
        role,
        true,
      ]
    );

    // KIRIM EMAIL KE USER
    await sendAccountEmail(
      email,
      name,
      password,
      role
    );

    return NextResponse.json({
      success: true,
      message: 'User berhasil dibuat dan email berhasil dikirim',
      userId: (result as any).insertId,
    });

  } catch (error) {
    console.error('Create user error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal membuat user',
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}