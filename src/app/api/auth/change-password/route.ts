import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

import { dbConfig } from '@/lib/db-config';

export async function PUT(request: NextRequest) {

  let connection;

  try {

    const {
      email,
      currentPassword,
      newPassword,
      confirmPassword
    } = await request.json();

    // VALIDASI
    if (
      !email ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          error: 'Semua field wajib diisi'
        },
        {
          status: 400
        }
      );
    }

    // VALIDASI PASSWORD BARU
    if (newPassword.length < 6) {

      return NextResponse.json(
        {
          error:
            'Password baru minimal 6 karakter'
        },
        {
          status: 400
        }
      );
    }

    // VALIDASI KONFIRMASI
    if (newPassword !== confirmPassword) {

      return NextResponse.json(
        {
          error:
            'Konfirmasi password tidak cocok'
        },
        {
          status: 400
        }
      );
    }

    connection = await mysql.createConnection(
      dbConfig
    );

    // CARI USER
    const [users]: any = await connection.execute(
      `
      SELECT *
      FROM user
      WHERE email = ?
      `,
      [email]
    );

    if (!users || users.length === 0) {

      return NextResponse.json(
        {
          error: 'User tidak ditemukan'
        },
        {
          status: 404
        }
      );
    }

    const user = users[0];

    // CEK PASSWORD LAMA
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {

      return NextResponse.json(
        {
          error: 'Password lama salah'
        },
        {
          status: 401
        }
      );
    }

    // HASH PASSWORD BARU
    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );

    // UPDATE PASSWORD
    await connection.execute(
      `
      UPDATE user
      SET password = ?
      WHERE id = ?
      `,
      [
        hashedPassword,
        user.id
      ]
    );

    return NextResponse.json({
      success: true,
      message:
        'Password berhasil diubah'
    });

  } catch (error) {

    console.error(
      'Change password error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Gagal mengubah password'
      },
      {
        status: 500
      }
    );

  } finally {

    if (connection) {
      await connection.end();
    }
  }
}