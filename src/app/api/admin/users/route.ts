import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { dbConfig } from '@/lib/db-config';

export async function GET(_request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // Get all users with their status and last login info
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

      await connection.end();

      return NextResponse.json({
        success: true,
        users: rows
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      throw new Error('Gagal mengambil data pengguna');
    }

  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mengambil data pengguna' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json();

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    // Validate role (support new roles)
    if (!['superadmin', 'admin', 'admin_pembelajaran', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // Check if email already exists
      const [existingUsers] = await connection.execute(
        'SELECT id FROM user WHERE email = ?',
        [email]
      );

      if (Array.isArray(existingUsers) && existingUsers.length > 0) {
        await connection.end();
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user
      const [result] = await connection.execute(
        'INSERT INTO user (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, role, true]
      );

      await connection.end();

      return NextResponse.json({
        success: true,
        message: 'User berhasil dibuat',
        userId: (result as any).insertId
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      throw new Error('Gagal membuat user');
    }

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat user' },
      { status: 500 }
    );
  }
}

